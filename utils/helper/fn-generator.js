/*
*
*  ©2016-2017 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
*  Bangalore, India. All Rights Reserved.
*
*/

const Big = require('big.js');
const _ = require('lodash');
const { valueT, valueInverseT, valueDT, valueInverseDT, valueDTD, valueInverseDTD, valueYMD, valueInverseYMD } = require('./value');
const { date, time, 'date and time': dateandtime } = require('../built-in-functions');

/*
dateTimeComponent contains the list of properties required for comparison.
property collection is in the order of priority of check
priority order is essential for inequality check
for inequality check the property appearing first in the list needs to be checked first
before moving on to the next properties in the list
*/
const dateTimeComponent = {
  time: ['hour', 'minute', 'second', 'time offset'],
  date: ['year', 'month', 'day'],
  dateandtime: ['year', 'month', 'day', 'hour', 'minute', 'second', 'time offset'],
};

const presence = (...args) => args.reduce((acc, arg) => acc && (arg || arg === 0), true);

const typeEq = (...args) => args.reduce((acc, arg) => acc && typeof arg === acc ? typeof arg : false, typeof args[0]); // eslint-disable-line

const presencetypeEq = (...args) => presence(...args) && typeEq(...args) && true;

const anyUndefined = (x, y) => x === undefined || y === undefined;
const getUndefined = (x, y) => {
  if (x === undefined) {
    return x;
  } else if (y === undefined) {
    return y;
  }
  throw new Error('Neither x nor y is undefined');
};

const operatorMap = {
  '<': _.curry((x, y) => {
    if (anyUndefined(x, y)) {
      return getUndefined(x, y);
    }
    try {
      if (presencetypeEq(x, y)) {
        if (typeof x === 'number' && typeof y === 'number') {
          return Big(x).lt(y);
        } else if (typeof x === 'string' && typeof y === 'string') {
          return x < y;
        } else if (x instanceof Date && y instanceof Date) {
          return x < y;
        } else if (x.isDate && y.isDate) {
          const checkLt = checkInequality('<', '>'); // eslint-disable-line no-use-before-define
          return checkLt(x, y, dateTimeComponent.date) > 0;
        } else if (x.isDateTime && y.isDateTime) {
          return valueDT(x) < valueDT(y);
        } else if (x.isTime && y.isTime) {
          // make y with the same offset as x before comparison
          const xOffset = x['time offset'];
          y.utcOffset(xOffset);
          return valueT(x) < valueT(y);
        } else if (x.isDtd && y.isDtd) {
          return valueDTD(x) < valueDTD(y);
        } else if (x.isYmd && y.isYmd) {
          return valueYMD(x) < valueYMD(y);
        }
        throw new Error(`${x.type || typeof x} < ${y.type || typeof y} : operation unsupported for one or more operands types`);
      }
      throw new Error(`${typeof x && x} < ${typeof y && y} : operation invalid for one or more operands types`);
    } catch (err) {
      throw err;
    }
  }),
  '<=': _.curry((x, y) => {
    if (anyUndefined(x, y)) {
      return getUndefined(x, y);
    }
    try {
      if (presencetypeEq(x, y)) {
        if (typeof x === 'number' && typeof y === 'number') {
          return Big(x).lte(y);
        } else if (typeof x === 'string' && typeof y === 'string') {
          return x <= y;
        } else if (x instanceof Date && y instanceof Date) {
          return x <= y;
        } else if (x.isDate && y.isDate) {
          const checkLt = checkInequality('<', '>'); // eslint-disable-line no-use-before-define
          return checkLt(x, y, dateTimeComponent.date) >= 0; // eslint-disable-line no-use-before-define
        } else if (x.isDateTime && y.isDateTime) {
          return valueDT(x) <= valueDT(y);
        } else if (x.isTime && y.isTime) {
          // make y with the same offset as x before comparison
          const xOffset = x['time offset'];
          y.utcOffset(xOffset);
          return valueT(x) <= valueT(y);
        } else if (x.isDtd && y.isDtd) {
          return valueDTD(x) <= valueDTD(y);
        } else if (x.isYmd && y.isYmd) {
          return valueYMD(x) <= valueYMD(y);
        }
        throw new Error(`${x.type || typeof x} <= ${y.type || typeof y} : operation unsupported for one or more operands types`);
      }
      throw new Error(`${typeof x && x} <= ${typeof y && y} : operation invalid for one or more operands types`);
    } catch (err) {
      throw err;
    }
  }),
  '>': _.curry((x, y) => {
    if (anyUndefined(x, y)) {
      return getUndefined(x, y);
    }
    try {
      if (presencetypeEq(x, y)) {
        if (typeof x === 'number' && typeof y === 'number') {
          return Big(x).gt(y);
        } else if (typeof x === 'string' && typeof y === 'string') {
          return x > y;
        } else if (x instanceof Date && y instanceof Date) {
          return x > y;
        } else if (x.isDate && y.isDate) {
          const checkGt = checkInequality('>', '<'); // eslint-disable-line no-use-before-define
          return checkGt(x, y, dateTimeComponent.date) > 0;
        } else if (x.isDateTime && y.isDateTime) {
          return valueDT(x) > valueDT(y);
        } else if (x.isTime && y.isTime) {
          // make y with the same offset as x before comparison
          const xOffset = x['time offset'];
          y.utcOffset(xOffset);
          return valueT(x) > valueT(y);
        } else if (x.isDtd && y.isDtd) {
          return valueDTD(x) > valueDTD(y);
        } else if (x.isYmd && y.isYmd) {
          return valueYMD(x) > valueYMD(y);
        }
        throw new Error(`${x.type || typeof x} > ${y.type || typeof y} : operation unsupported for one or more operands types`);
      }
      throw new Error(`${typeof x && x} > ${typeof y && y} : operation invalid for one or more operands types`);
    } catch (err) {
      throw err;
    }
  }),
  '>=': _.curry((x, y) => {
    if (anyUndefined(x, y)) {
      return getUndefined(x, y);
    }
    try {
      if (presencetypeEq(x, y)) {
        if (typeof x === 'number' && typeof y === 'number') {
          return Big(x).gte(y);
        } else if (typeof x === 'string' && typeof y === 'string') {
          return x >= y;
        } else if (x instanceof Date && y instanceof Date) {
          return x >= y;
        } else if (x.isDate && y.isDate) {
          const checkGt = checkInequality('>', '<'); // eslint-disable-line no-use-before-define
          return checkGt(x, y, dateTimeComponent.date) >= 0; // eslint-disable-line no-use-before-define
        } else if (x.isDateTime && y.isDateTime) {
          return valueDT(x) >= valueDT(y);
        } else if (x.isTime && y.isTime) {
          // make y with the same offset as x before comparison
          const xOffset = x['time offset'];
          y.utcOffset(xOffset);
          return valueT(x) >= valueT(y);
        } else if (x.isDtd && y.isDtd) {
          return valueDTD(x) >= valueDTD(y);
        } else if (x.isYmd && y.isYmd) {
          return valueYMD(x) >= valueYMD(y);
        }
        throw new Error(`${x.type || typeof x} >= ${y.type || typeof y} : operation unsupported for one or more operands types`);
      }
      throw new Error(`${typeof x && x} >= ${typeof y && y} : operation invalid for one or more operands types`);
    } catch (err) {
      throw err;
    }
  }),
  '==': _.curry((x, y) => {
    if (anyUndefined(x, y)) {
      return getUndefined(x, y);
    }
    try {
      if (x === null && y === null) {
        return true;
      } else if ((x === null) !== (y === null)) {
        return false;
      } else if (typeof x === 'number' && typeof y === 'number') {
        return Big(x).eq(y);
      } else if (typeof x === 'string' && typeof y === 'string') {
        return x === y;
      } else if (x instanceof Date && y instanceof Date) {
        return x.getTime() === y.getTime();
      } else if (typeof x === 'boolean' && typeof y === 'boolean') {
        return x === y;
      } else if (x.isDate && y.isDate) {
        return checkEquality(x, y, dateTimeComponent.date); // eslint-disable-line no-use-before-define
      } else if (x.isDateTime && y.isDateTime) {
        // make y with the same offset as x before comparison
        const xOffset = x['time offset'];
        y.utcOffset(xOffset);
        return checkEquality(x, y, dateTimeComponent.dateandtime); // eslint-disable-line no-use-before-define
      } else if (x.isTime && y.isTime) {
        // make y with the same offset as x before comparison
        const xOffset = x['time offset'];
        y.utcOffset(xOffset);
        return checkEquality(x, y, dateTimeComponent.time); // eslint-disable-line no-use-before-define
      } else if (x.isDtd && y.isDtd) {
        return valueDTD(x) === valueDTD(y);
      } else if (x.isYmd && y.isYmd) {
        return valueYMD(x) === valueYMD(y);
      } else if (x.isList && y.isList) {
        return _.isEqual(x, y);
      }
      throw new Error(`${x.type || typeof x} = ${y.type || typeof y} : operation unsupported for one or more operands types`);
    } catch (err) {
      throw err;
    }
  }),
  '!=': _.curry((x, y) => {
    try {
      let equalsValue = operatorMap['=='](x, y);
      if (equalsValue !== undefined) {
        equalsValue = !equalsValue;
      }
      return equalsValue;
    } catch (err) {
      throw err;
    }
  }),
  '||': _.curry((x, y) => x || y),
  '&&': _.curry((x, y) => x && y),
  '+': _.curry((x, y) => {
    if (anyUndefined(x, y)) {
      return getUndefined(x, y);
    }
    if (presence(x, y)) {
      if (typeof x === 'number' && typeof y === 'number') {
        return Number(Big(x).plus(y));
      } else if (typeof x === 'string' && typeof y === 'string') {
        return x + y;
      } else if ((typeof x === 'string' && typeof y === 'number') || (typeof x === 'number' && typeof y === 'string')) {
        return x + y;
      } else if ((x.isDateTime || x.isDate) && (y.isDateTime || y.isDate)) {
        throw new Error(`${x.type} + ${y.type} : operation unsupported for one or more operands types`);
      } else if (x.isTime && y.isTime) {
        throw new Error(`${x.type} + ${y.type} : operation unsupported for one or more operands types`);
      } else if (x.isYmd && y.isYmd) {
        return valueInverseYMD(valueYMD(x) + valueYMD(y));
      } else if (x.isDtd && y.isDtd) {
        return valueInverseDTD(valueDTD(x) + valueDTD(y));
      } else if (x.isDateTime && y.isYmd) {
        return dateandtime(date(x.year + y.years + Math.floor((x.month + y.months) / 12), (x.month + y.months) - (Math.floor((x.month + y.months) / 12) * 12), x.day), time(x));
      } else if (x.isDate && y.isYmd) {
        return date(x.year + y.years + Math.floor((x.month + y.months) / 12), (x.month + y.months) - (Math.floor((x.month + y.months) / 12) * 12), x.day);
      } else if (x.isYmd && (y.isDateTime || y.isDate)) {
        return dateandtime(date(y.year + x.years + Math.floor((y.month + x.months) / 12), (y.month + x.months) - (Math.floor((y.month + x.months) / 12) * 12), y.day), time(y));
      } else if ((x.isDateTime || x.isDate) && y.isDtd) {
        return valueInverseDT((valueDT(x) + valueDTD(y)), x['time offset']);
      } else if (x.isDtd && (y.isDateTime || y.isDate)) {
        return valueInverseDT((valueDT(y) + valueDTD(x)), y['time offset']);
      } else if (x.isTime && y.isDtd) {
        return valueInverseT((valueT(x) + valueDTD(y)), x['time offset']);
      } else if (x.isDtd && y.isTime) {
        return valueInverseT((valueT(y) + valueDTD(x)), y['time offset']);
      }
      throw new Error(`${x.type || typeof x} + ${y.type || typeof y} : operation unsupported for one or more operands types`);
    }
    throw new Error(`${typeof x && x} + ${typeof y && y} : operation invalid for one or more operands types`);
  }),

  '-': _.curry((x, y) => {
    if (anyUndefined(x, y)) {
      return getUndefined(x, y);
    }
    if (!x && y) {
      return -y;
    }
    if (presence(x, y)) {
      if (typeof x === 'number' && typeof y === 'number') {
        return Number(Big(x).minus(y));
      } else if (typeof x === 'string' && typeof y === 'string') {
        throw new Error(`${x.type} - ${y.type} : operation unsupported for one or more operands types`);
      } else if ((x.isDateTime || x.isDate) && (y.isDateTime || y.isDate)) {
        return valueInverseDTD(valueDT(x) - valueDT(y));
      } else if (x.isTime && y.isTime) {
        return valueInverseDTD(valueT(x) - valueT(y));
      } else if (x.isYmd && y.isYmd) {
        return valueInverseYMD(valueYMD(x) - valueYMD(y));
      } else if (x.isDtd && y.isDtd) {
        return valueInverseDTD(valueDTD(x) - valueDTD(y));
      } else if (x.isDateTime && y.isYmd) {
        return dateandtime(date((x.year - y.years) + Math.floor((x.month - y.months) / 12), (x.month - y.months) - (Math.floor((x.month - y.months) / 12) * 12), x.day), time(x));
      } else if (x.isDate && y.isYmd) {
        return date((x.year - y.years) + Math.floor((x.month - y.months) / 12), (x.month - y.months) - (Math.floor((x.month - y.months) / 12) * 12), x.day);
      } else if (x.isYmd && (y.isDateTime || y.isDate)) {
        throw new Error(`${x.type} - ${y.type} : operation unsupported for one or more operands types`);
      } else if ((x.isDateTime || x.isDate) && y.isDtd) {
        return valueInverseDT(valueDT(x) - valueDTD(y), x['time offset']);
      } else if (x.isDtd && (y.isDateTime || y.isDate)) {
        throw new Error(`${x.type} - ${y.type} : operation unsupported for one or more operands types`);
      } else if (x.isTime && y.isDtd) {
        return valueInverseT(valueT(x) - valueDTD(y), x['time offset']);
      } else if (x.isDtd && y.isTime) {
        throw new Error(`${x.type} - ${y.type} : operation unsupported for one or more operands types`);
      }
      throw new Error(`${x.type || typeof x} - ${y.type || typeof y} : operation unsupported for one or more operands types`);
    }
    throw new Error(`${typeof x && x} - ${typeof y && y} : operation invalid for one or more operands types`);
  }),

  '*': _.curry((x, y) => {
    if (anyUndefined(x, y)) {
      return getUndefined(x, y);
    }
    if (presence(x, y)) {
      if (typeof x === 'number' && typeof y === 'number') {
        return Number(Big(x).times(y));
      } else if (x.isYmd && typeof y === 'number') {
        return valueInverseYMD(valueYMD(x) * y);
      } else if (typeof x === 'number' && y.isYmd) {
        return valueInverseYMD(x * valueYMD(y));
      } else if (x.isDtd && typeof y === 'number') {
        return valueInverseDTD(valueDTD(x) * y);
      } else if (typeof x === 'number' && y.isDtd) {
        return valueInverseDTD(x * valueDTD(y));
      }
      throw new Error(`${x.type || typeof x} * ${y.type || typeof y} : operation unsupported for one or more operands types`);
    }
    throw new Error(`${typeof x && x} * ${typeof y && y} : operation invalid for one or more operands types`);
  }),
  '/': _.curry((x, y) => {
    if (anyUndefined(x, y)) {
      return getUndefined(x, y);
    }
    if (presence(x, y)) {
      if (typeof x === 'number' && typeof y === 'number') {
        return Number(Big(x).div(y));
      } else if (x.isYmd && typeof y === 'number') {
        return y === 0 ? null : valueInverseYMD(valueYMD(x) / y);
      } else if (typeof x === 'number' && y.isYmd) {
        return x === 0 ? null : valueInverseYMD(valueYMD(y) / x);
      } else if (x.isDtd && typeof y === 'number') {
        return y === 0 ? null : valueInverseDTD(valueDTD(x) / y);
      } else if (typeof x === 'number' && y.isDtd) {
        return x === 0 ? null : valueInverseDTD(valueDTD(y) / x);
      }
      throw new Error(`${x.type || typeof x} / ${y.type || typeof y} : operation unsupported for one or more operands types`);
    }
    throw new Error(`${typeof x && x} / ${typeof y && y} : operation invalid for one or more operands types`);
  }),

  '**': _.curry((x, y) => {
    if (anyUndefined(x, y)) {
      return getUndefined(x, y);
    }
    if (presence(x, y)) {
      if (typeof x === 'number' && typeof y === 'number') {
        return Number(Big(x).pow(y));
      }
      throw new Error(`${x.type || typeof x} ** ${y.type || typeof y} : operation unsupported for one or more operands types`);
    }
    throw new Error(`${typeof x && x} ** ${typeof y && y} : operation invalid for one or more operands types`);
  }),
};

function checkEquality(x, y, props) {
  return props.reduce((recur, next) => recur && x[next] === y[next], true);
}

function checkInequality(opTrue, opFalse) {
  const fnTrue = operatorMap[opTrue];
  const fnFalse = operatorMap[opFalse];
  return function (x, y, props) {
    return props.reduce((recur, next) => {
      if (recur !== 0) {
        return recur;
      }
      if (fnTrue(x[next], y[next])) {
        return 1;
      }
      if (fnFalse(x[next], y[next])) {
        return -1;
      }
      return 0;
    }, 0);
  };
}

module.exports = operator => operatorMap[operator];
