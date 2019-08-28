/*
*  ©2017-2018 HBT Hamburger Berater Team GmbH
*  All Rights Reserved.
*/
const DmnModdle = require('dmn-moddle');
const logger = require('loglevel').getLogger('dmn-eval-js');
const feel = require('../../dist/feel');
const moment = require('moment');

function createModdle(additionalPackages, options) {
  return new DmnModdle(additionalPackages, options);
}

function readDmnXml(xml, opts, callback) {
  return createModdle().fromXML(xml, 'dmn:Definitions', opts, callback);
}

function parseRule(rule, idx) {
  const parsedRule = { number: idx + 1, input: [], inputValues: [], output: [], outputValues: [] };
  rule.inputEntry.forEach((inputEntry) => {
    let text = inputEntry.text;
    if (text === '') {
      text = '-';
    }
    try {
      parsedRule.input.push(feel.parse(text, {
        startRule: 'SimpleUnaryTests',
      }));
      parsedRule.inputValues.push(text);
    } catch (err) {
      throw new Error(`Failed to parse input entry: ${text} ${err}`);
    }
  });
  rule.outputEntry.forEach((outputEntry) => {
    if (!outputEntry.text) {
      parsedRule.output.push(null);
      parsedRule.outputValues.push(null);
    } else {
      try {
        parsedRule.output.push(feel.parse(outputEntry.text, {
          startRule: 'SimpleExpressions',
        }));
      } catch (err) {
        throw new Error(`Failed to parse output entry: ${outputEntry.text} ${err}`);
      }
      parsedRule.outputValues.push(outputEntry.text);
    }
  });
  return parsedRule;
}

function parseDecisionTable(decisionId, decisionTable) {
  if ((decisionTable.hitPolicy !== 'FIRST') && (decisionTable.hitPolicy !== 'UNIQUE')
      && (decisionTable.hitPolicy !== 'COLLECT') && (decisionTable.hitPolicy !== 'RULE ORDER')) {
    throw new Error(`Unsupported hit policy ${decisionTable.hitPolicy}`);
  }
  const parsedDecisionTable = { hitPolicy: decisionTable.hitPolicy, rules: [], inputExpressions: [], parsedInputExpressions: [], outputNames: [] };

  // parse rules (there may be none, though)
  if (decisionTable.rule === undefined) {
    logger.warn(`The decision table for decision '${decisionId}' contains no rules.`);
  } else {
    decisionTable.rule.forEach((rule, idx) => {
      parsedDecisionTable.rules.push(parseRule(rule, idx));
    });
  }

  // parse input expressions
  decisionTable.input.forEach((input) => {
    let inputExpression;
    if (input.inputExpression && input.inputExpression.text) {
      inputExpression = input.inputExpression.text;
    } else if (input.inputVariable) {
      inputExpression = input.inputVariable;
    } else {
      throw new Error(`No input variable or expression set for input '${input.id}'`);
    }
    parsedDecisionTable.inputExpressions.push(inputExpression);
    try {
      parsedDecisionTable.parsedInputExpressions.push(feel.parse(inputExpression, {
        startRule: 'SimpleExpressions',
      }));
    } catch (err) {
      throw new Error(`Failed to parse input expression '${inputExpression}': ${err}`);
    }
  });

  // parse output names
  decisionTable.output.forEach((output) => {
    if (output.name) {
      parsedDecisionTable.outputNames.push(output.name);
    } else {
      throw new Error(`No name set for output "${output.id}"`);
    }
  });
  return parsedDecisionTable;
}

function parseDecisions(drgElements) {
  const parsedDecisions = [];
  // iterate over all decisions in the DMN
  drgElements.forEach((drgElement) => {
    if (drgElement.decisionTable) {
      // parse the decision table...
      const decision = { decisionTable: parseDecisionTable(drgElement.id, drgElement.decisionTable), requiredDecisions: [] };
      // ...and collect the decisions on which the current decision depends
      if (drgElement.informationRequirement !== undefined) {
        drgElement.informationRequirement.forEach((req) => {
          if (req.requiredDecision !== undefined) {
            const requiredDecisionId = req.requiredDecision.href.replace('#', '');
            decision.requiredDecisions.push(requiredDecisionId);
          }
        });
      }
      parsedDecisions[drgElement.id] = decision;
    }
  });
  return parsedDecisions;
}

function parseDmnXml(xml, opts) {
  return new Promise((resolve, reject) => {
    readDmnXml(xml, opts, (err, dmnContent) => {
      if (err) {
        reject(err);
      } else {
        try {
          const decisions = parseDecisions(dmnContent.drgElements);
          resolve(decisions);
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}

function resolveExpression(expression, obj) {
  const parts = expression.split('.');
  return parts.reduce((resolved, part) => (resolved === undefined ? undefined : resolved[part]), obj);
}

// Sets the given value to a nested property of the given object. The nested property is resolved from the given expression.
// If the given nested property does not exist, it is added. If it exists, it is set (overwritten). If it exists and is
// an array, the given value is added.
// Examples:
//   setOrAddValue('foo.bar', { }, 10) returns { foo: { bar: 10 } }
//   setOrAddValue('foo.bar', { foo: { }, 10) returns { foo: { bar: 10 } }
//   setOrAddValue('foo.bar', { foo: { bar: 9 }, 10) returns { foo: { bar: 10 } }
//   setOrAddValue('foo.bar', { foo: { bar: [ ] }, 10) returns { foo: { bar: [ 10 ] } }
//   setOrAddValue('foo.bar', { foo: { bar: [ 9 ] }, 10) returns { foo: { bar: [9, 10 ] } }
function setOrAddValue(expression, obj, value) {
  const indexOfDot = expression.indexOf('.');
  if (indexOfDot < 0) {
    if (obj[expression] && Array.isArray(obj[expression])) {
      obj[expression].push(value); // eslint-disable-line no-param-reassign
    } else {
      obj[expression] = value; // eslint-disable-line no-param-reassign
    }
  } else {
    const first = expression.substr(0, indexOfDot);
    const remainder = expression.substr(indexOfDot + 1);
    if (obj[first]) {
      setOrAddValue(remainder, obj[first], value);
    } else {
      obj[first] = setOrAddValue(remainder, {}, value); // eslint-disable-line no-param-reassign
    }
  }
  return obj;
}

// merge the result of the required decision into the context so that it is available as input for the requested decision
function mergeContext(context, additionalContent, aggregate = false) {
  if (Array.isArray(additionalContent)) {
    // additional content is the result of evaluation a rule table with multiple rule results
    additionalContent.forEach(ruleResult => mergeContext(context, ruleResult, true));
  } else {
    // additional content is the result of evaluation a rule table with a single rule result
    for (const prop in additionalContent) { // eslint-disable-line no-restricted-syntax
      if (additionalContent.hasOwnProperty(prop)) {
        const value = additionalContent[prop];
        if (Array.isArray(context[prop])) {
          if (Array.isArray(value)) {
            context[prop] = context[prop].concat(value); // eslint-disable-line no-param-reassign
          } else if (value !== null && value !== undefined) {
            context[prop].push(value); // eslint-disable-line no-param-reassign
          }
        } else if ((typeof value === 'object') && (value !== null) && !moment.isMoment(value) && !moment.isDate(value) && !moment.isDuration(value)) {
          if ((context[prop] === undefined) || (context[prop] === null)) {
            context[prop] = {}; // eslint-disable-line no-param-reassign
          }
          mergeContext(context[prop], value, aggregate);
        } else if (aggregate) {
          context[prop] = []; // eslint-disable-line no-param-reassign
          context[prop].push(value); // eslint-disable-line no-param-reassign
        } else {
          context[prop] = value; // eslint-disable-line no-param-reassign
        }
      }
    }
  }
}

function evaluateRule(rule, resolvedInputExpressions, outputNames, context) {
  for (let i = 0; i < rule.input.length; i += 1) {
    try {
      const inputVariableName = resolvedInputExpressions[i].inputVariableName;
      const inputFunction = rule.input[i].build(Object.assign({ _inputVariableName: inputVariableName }, context)); // eslint-disable-line no-await-in-loop
      if (!inputFunction(resolvedInputExpressions[i].value)) {
        return {
          matched: false,
        };
      }
    } catch (err) {
      logger.error(err);
      throw new Error(`Failed to evaluate input condition in column ${i + 1}: '${rule.inputValues[i]}': ${err}`);
    }
  }
  const outputObject = {};
  for (let i = 0; i < rule.output.length; i += 1) {
    if (rule.output[i] !== null) {
      const outputValue = rule.output[i].build(context); // eslint-disable-line no-await-in-loop
      setOrAddValue(outputNames[i], outputObject, outputValue[0]);
    } else {
      setOrAddValue(outputNames[i], outputObject, undefined);
    }
  }
  return { matched: true, output: outputObject };
}

function evaluateDecision(decisionId, decisions, context, alreadyEvaluatedDecisions) {
  if (!alreadyEvaluatedDecisions) {
    alreadyEvaluatedDecisions = []; // eslint-disable-line no-param-reassign
  }
  const decision = decisions[decisionId];
  if (decision === undefined) {
    throw new Error(`No such decision "${decisionId}"`);
  }

  // execute required decisions recursively first
  for (let i = 0; i < decision.requiredDecisions.length; i += 1) {
    const reqDecision = decision.requiredDecisions[i];
    // check if the decision was already executed, to prevent unecessary evaluations if multiple decisions require the same decision
    if (!alreadyEvaluatedDecisions[reqDecision]) {
      logger.debug(`Need to evaluate required decision ${reqDecision}`);
      const requiredResult = evaluateDecision(reqDecision, decisions, context, alreadyEvaluatedDecisions); // eslint-disable-line no-await-in-loop
      mergeContext(context, requiredResult);
      alreadyEvaluatedDecisions[reqDecision] = true; // eslint-disable-line no-param-reassign
    }
  }
  logger.info(`Evaluating decision "${decisionId}"...`);
  logger.debug(`Context: ${JSON.stringify(context)}`);
  const decisionTable = decision.decisionTable;

  // resolve input expressions
  const resolvedInputExpressions = [];
  for (let i = 0; i < decisionTable.parsedInputExpressions.length; i += 1) {
    const parsedInputExpression = decisionTable.parsedInputExpressions[i];
    const plainInputExpression = decisionTable.inputExpressions[i];
    try {
      const resolvedInputExpression = parsedInputExpression.build(context); // eslint-disable-line no-await-in-loop
      // check if the input expression is to be treated as an input variable - this is the case if it is a qualified name
      let inputVariableName;
      if (parsedInputExpression.simpleExpressions && parsedInputExpression.simpleExpressions[0].type === 'QualifiedName') {
        inputVariableName = parsedInputExpression.simpleExpressions[0].names.map(nameNode => nameNode.nameChars).join('.');
      }
      resolvedInputExpressions.push({ value: resolvedInputExpression[0], inputVariableName });
    } catch (err) {
      throw new Error(`Failed to evaluate input expression ${plainInputExpression} of decision ${decisionId}: ${err}`);
    }
  }

  // initialize the result to an object with undefined output values (hit policy FIRST or UNIQUE) or to an empty array (hit policy COLLECT or RULE ORDER)
  const decisionResult = (decisionTable.hitPolicy === 'FIRST') || (decisionTable.hitPolicy === 'UNIQUE') ? {} : [];
  decisionTable.outputNames.forEach((outputName) => {
    if ((decisionTable.hitPolicy === 'FIRST') || (decisionTable.hitPolicy === 'UNIQUE')) {
      setOrAddValue(outputName, decisionResult, undefined);
    }
  });

  // iterate over the rules of the decision table of the requested decision,
  // and either return the output of the first matching rule (hit policy FIRST)
  // or collect the output of all matching rules (hit policy COLLECT)
  let hasMatch = false;
  for (let i = 0; i < decisionTable.rules.length; i += 1) {
    const rule = decisionTable.rules[i];
    let ruleResult;
    try {
      ruleResult = evaluateRule(rule, resolvedInputExpressions, decisionTable.outputNames, context); // eslint-disable-line no-await-in-loop
    } catch (err) {
      throw new Error(`Failed to evaluate rule ${rule.number} of decision ${decisionId}:  ${err}`);
    }
    if (ruleResult.matched) {
      // only one match for hit policy UNIQUE!
      if (hasMatch && (decisionTable.hitPolicy === 'UNIQUE')) {
        throw new Error(`Decision "${decisionId}" is not unique but hit policy is UNIQUE.`);
      }
      hasMatch = true;
      logger.info(`Result for decision "${decisionId}": ${JSON.stringify(ruleResult.output)} (rule ${i + 1} matched)`);

      // merge the result of the matched rule
      if ((decisionTable.hitPolicy === 'FIRST') || (decisionTable.hitPolicy === 'UNIQUE')) {
        decisionTable.outputNames.forEach((outputName) => {
          const resolvedOutput = resolveExpression(outputName, ruleResult.output);
          if (resolvedOutput !== undefined || decisionTable.hitPolicy === 'FIRST' || decisionTable.hitPolicy === 'UNIQUE') {
            setOrAddValue(outputName, decisionResult, resolvedOutput);
          }
        });
        if (decisionTable.hitPolicy === 'FIRST') {
          // no more rule results in this case
          break;
        }
      } else {
        decisionResult.push(ruleResult.output);
      }
    }
  }
  if (!hasMatch && decisionTable.rules.length > 0) {
    logger.warn(`No rule matched for decision "${decisionId}".`);
  }
  return decisionResult;
}

function dumpTree(node, indent) {
  if (!node) {
    logger.debug('undefined');
    return;
  }
  if (!indent) {
    indent = ''; // eslint-disable-line no-param-reassign
  }
  logger.debug(indent + node.type);
  if (node.not) {
    logger.debug(`${indent}  (not)`);
  }
  if (node.operator) {
    logger.debug(`${indent}  ${node.operator}`);
  }
  const newIndent = `${indent}  `;
  switch (node.type) {
    case 'ArithmeticExpression': {
      dumpTree(node.operand_1, newIndent);
      dumpTree(node.operand_2, newIndent);
      break;
    }
    case 'FunctionInvocation': {
      dumpTree(node.fnName, newIndent);
      dumpTree(node.params, newIndent);
      break;
    }
    case 'DateTimeLiteral': node.params.forEach(p => dumpTree(p, newIndent)); break;
    case 'Interval': {
      dumpTree(node.startpoint, newIndent);
      dumpTree(node.endpoint, newIndent);
      break;
    }
    case 'Literal': logger.debug(`${newIndent}"${node.value}"`); break;
    case 'Name': logger.debug(`${newIndent}"${node.nameChars}"`); break;
    case 'Program': dumpTree(node.body, newIndent); break;
    case 'PositionalParameters': node.params.forEach(p => dumpTree(p, newIndent)); break;
    case 'QualifiedName': node.names.forEach(n => dumpTree(n, newIndent)); break;
    case 'SimpleExpressions': node.simpleExpressions.forEach(s => dumpTree(s, newIndent)); break;
    case 'SimplePositiveUnaryTest': dumpTree(node.operand, newIndent); break;
    case 'SimpleUnaryTestsNode': node.expr.forEach(e => dumpTree(e, newIndent)); break;
    case 'UnaryTestsNode': node.expr.forEach(e => dumpTree(e, newIndent)); break;
    default: logger.debug('?');
  }
}

module.exports = { readDmnXml, parseDmnXml, parseDecisions, evaluateDecision, dumpTree };
