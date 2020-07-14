/*
 *
 *  ©2016-2017 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 *  Bangalore, India. All Rights Reserved.
 *
 */

const _ = require('lodash');
const logger = require('loglevel').getLogger('dmn-eval-js');
const fnGen = require('../utils/helper/fn-generator');
const addKwargs = require('../utils/helper/add-kwargs');
const builtInFns = require('../utils/built-in-functions');
const resolveName = require('../utils/helper/name-resolution.js');

module.exports = function (ast) {
  ast.ProgramNode.prototype.build = function (data = {}, env = {}, type = 'output') {
    let args = {};
    if (!data.isContextBuilt) {
      const context = { ...data, ...builtInFns };
      args = { context, ...env };
      args.isContextBuilt = true;
    } else {
      args = data;
    }
    // bodybuilding starts here...
    // let's pump some code ;)
    const result = this.body.build(args);
    if (type === 'input') {
      if (typeof result === 'function') {
        return result;
      }
      const fnResult = function (x) {
        return x === result;
      };
      return fnResult;
    }
    return result;
  };

  ast.IntervalStartLiteralNode.prototype.build = function () {
    return fnGen(this.intervalType);
  };

  ast.IntervalEndLiteralNode.prototype.build = function () {
    return fnGen(this.intervalType);
  };

  ast.IntervalNode.prototype.build = function (args) {
    const startpoint = this.startpoint.build(args);
    const endpoint = this.endpoint.build(args);
    return (x) => {
      const startValue = this.intervalstart.build()(startpoint)(x);
      const endValue = this.intervalend.build()(endpoint)(x);
      return startValue === undefined || endValue === undefined ? undefined : startValue && endValue;
    };
  };

  ast.SimplePositiveUnaryTestNode.prototype.build = function (args) {
    const result = this.operand.build(args);

    // hack to treat input expressions as input variables and let functions in input entries reference them
    // for example: starts with(name, prefix)
    // where "name" is the input expression
    // for this to work, if the result of the function is true (like in the example above), that value cannot be
    // compared with the the evaluated input expression (which is the value of the input variable), so we must
    // patch the comparison here
    if (args.context._inputVariableName && this.operand.type === 'FunctionInvocation' && this.operand.params) {
      // patch only if there is an input variable and the simple positive unary test contains a function directly,
      // where the input variable in a parameter of that function
      const nodeIsQualifiedNameOfInputVariable = (node) => node.type === 'QualifiedName' && node.names.map((nameNode) => nameNode.nameChars).join('.') === args.context._inputVariableName;
      const inputVariableParameter = (this.operand.params.params || []).find((node) => nodeIsQualifiedNameOfInputVariable(node));
      if (inputVariableParameter) {
        if (result === true) {
          // if the function evaluates to true, compare the evaluated input expression with the evaluated input variable,
          // not with the result of the function evaluation
          return fnGen(this.operator || '==')(_, inputVariableParameter.build(args));
        } if (result === false) {
          // if the function evaluates to false, the simple positive unary test should always evaluate to false
          return () => false;
        }
      }
    }

    return fnGen(this.operator || '==')(_, result);
  };

  ast.SimpleUnaryTestsNode.prototype.build = function (data = {}) {
    const context = { ...data, ...builtInFns };
    const args = { context };
    if (this.expr) {
      const results = this.expr.map((d) => d.build(args));
      if (this.not) {
        const negResults = results.map((result) => args.context.not(result));
        return (x) => negResults.reduce((result, next) => {
          const nextValue = next(x);
          return (result === false || nextValue === false) ? false : ((result === undefined || nextValue === undefined) ? undefined : (result && nextValue));
        }, true);
      }
      return (x) => results.reduce((result, next) => {
        const nextValue = next(x);
        return (result === true || nextValue === true) ? true : ((result === undefined || nextValue === undefined) ? undefined : (result || nextValue));
      }, false);
    }
    return () => true;
  };

  ast.QualifiedNameNode.prototype.build = function (args, doNotWarnIfUndefined = false) {
    const [first, ...remaining] = this.names;
    const buildNameNode = (name) => {
      const result = { nameNode: name, value: name.build(null, false) };
      return result;
    };
    const processRemaining = (firstResult, firstExpression) => remaining.map(buildNameNode)
      .reduce((prev, next) => {
        if (prev.value === undefined) {
          return prev;
        }
        return { value: prev.value[next.value], expression: `${prev.expression}.${next.nameNode.nameChars}` };
      }, { value: firstResult, expression: firstExpression });

    const firstResult = first.build(args);
    if (remaining.length) {
      const fullResult = processRemaining(firstResult, first.nameChars);
      if (fullResult.value === undefined) {
        if (!doNotWarnIfUndefined) {
          logger.info(`'${fullResult.expression}' resolved to undefined`);
        }
      }
      return fullResult.value;
    }
    if (firstResult === undefined) {
      if (!doNotWarnIfUndefined) {
        logger.info(`'${first.nameChars}' resolved to undefined`);
      }
    }
    return firstResult;
  };

  ast.ArithmeticExpressionNode.prototype.build = function (args) {
    const operandsResult = [this.operand_1, this.operand_2].map((op) => {
      if (op === null) {
        return 0;
      }
      return op.build(args);
    });
    return fnGen(this.operator)(operandsResult[0])(operandsResult[1]);
  };

  ast.SimpleExpressionsNode.prototype.build = function (data = {}, env = {}) {
    let context = {};
    if (!data.isBuiltInFn) {
      context = { ...data, ...builtInFns, isBuiltInFn: true };
    } else {
      context = data;
    }
    const args = { context, ...env };
    return this.simpleExpressions.map((d) => d.build(args));
  };

  // _fetch is used to return the name string or
  // the value extracted from context or kwargs using the name string
  ast.NameNode.prototype.build = function (args, _fetch = true) {
    const name = this.nameChars;
    if (!_fetch) {
      return name;
    }

    return resolveName(name, args);
  };

  ast.LiteralNode.prototype.build = function () {
    return this.value;
  };

  ast.DateTimeLiteralNode.prototype.build = function (args) {
    const fn = args.context[this.symbol];
    const paramsResult = this.params.map((d) => d.build(args));
    let result;
    if (!paramsResult.includes(undefined)) {
      result = fn(...paramsResult);
    }
    return result;
  };

  // Invoking function defined as boxed expression in the context entry
  // See ast.FunctionDefinitionNode for details on declaring function
  // Function supports positional as well as named parameters
  ast.FunctionInvocationNode.prototype.build = function (args) {
    const processFormalParameters = (formalParams) => {
      const values = this.params.build(args);
      if (formalParams && values && Array.isArray(values)) {
        const kwParams = values.reduce((recur, next, i) => {
          const obj = {};
          obj[formalParams[i]] = next;
          return { ...recur, ...obj };
        }, {});
        return addKwargs(args, kwParams);
      }
      return addKwargs(args, values);
    };

    const processUserDefinedFunction = (fnMeta) => {
      const { fn } = fnMeta;
      const formalParams = fnMeta.params;

      if (formalParams) {
        return fn.build(processFormalParameters(formalParams));
      }
      return fn.build(args);
    };

    const processInBuiltFunction = (fnMeta) => {
      const doNotWarnIfUndefined = fnMeta.name === 'defined';
      const values = this.params.build(args, doNotWarnIfUndefined);
      if (Array.isArray(values)) {
        return fnMeta(...[...values, args.context]);
      }
      return fnMeta({ ...args.context, ...args.kwargs }, values);
    };

    const processDecision = (fnMeta) => {
      const { expr } = fnMeta;
      if (expr.body instanceof ast.FunctionDefinitionNode) {
        const exprResult = expr.body.build(args);
        return processUserDefinedFunction(exprResult);
      }
      const formalParametersResult = processFormalParameters();
      return expr.build(formalParametersResult);
    };

    const processFnMeta = (fnMeta) => {
      if (typeof fnMeta === 'function') {
        return processInBuiltFunction(fnMeta);
      } if (typeof fnMeta === 'object' && fnMeta.isDecision) {
        return processDecision(fnMeta);
      }
      return processUserDefinedFunction(fnMeta);
    };

    const fnNameResult = this.fnName.build(args);
    let result;
    if (fnNameResult !== undefined) {
      result = processFnMeta(fnNameResult);
    }
    return result;
  };

  ast.PositionalParametersNode.prototype.build = function (args, doNotWarnIfUndefined = false) {
    const results = this.params.map((d) => d.build(args, doNotWarnIfUndefined));
    return results;
  };

  ast.ComparisonExpressionNode.prototype.build = function (args) {
    let { operator } = this;
    if (operator === 'between') {
      const results = [this.expr_1, this.expr_2, this.expr_3].map((d) => d.build(args));
      if ((results[0] >= results[1]) && (results[0] <= results[2])) {
        return true;
      }
      return false;
    } if (operator === 'in') {
      const processExpr = (operand) => {
        this.expr_2 = Array.isArray(this.expr_2) ? this.expr_2 : [this.expr_2];
        const tests = this.expr_2.map((d) => d.build(args));
        return tests.map((test) => test(operand)).reduce((accu, next) => accu || next, false);
      };
      return processExpr(this.expr_1.build(args));
    }
    const results = [this.expr_1, this.expr_2].map((d) => d.build(args));
    operator = operator !== '=' ? operator : '==';
    return fnGen(operator)(results[0])(results[1]);
  };
};
