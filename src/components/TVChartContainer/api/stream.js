// api/stream.js
import historyProvider from './historyProvider.js'

const WebSocket = require('isomorphic-ws');
const socket = new WebSocket('wss://api.hitbtc.com/api/2/ws');

var _subs = []

export default {
  subscribeBars: function (symbolInfo, resolution, updateCb, uid, resetCache) {
    console.log('Start subscribeBars')

    var pairName = symbolInfo.full_name.slice(-7).replace('/', '');
    console.log('pair name', pairName)

    var charPendix = 'M'
    if (resolution === 'D') {
      charPendix = resolution + '1'
    } else if (resolution > 30 && resolution <= 240) {
      charPendix = 'H' + resolution / 60
    } else {
      charPendix = 'M' + resolution
    }

    var rqParam = {
      "method": "subscribeCandles",
      "params": {
        "symbol": pairName,
        "period": charPendix
      },
      "id": 123
    }
    rqParam = JSON.stringify(rqParam)

    try {
      socket.send(rqParam);
    } catch (error) {
      console.error('error', error);
    }

    var newSub = {
      rqParam,
      uid,
      resolution,
      symbolInfo,
      lastBar: historyProvider.history[symbolInfo.name].lastBar,
      listener: updateCb,
    }
    _subs.push(newSub)
  },
  unsubscribeBars: function (uid) {
    var subIndex = _subs.findIndex(e => e.uid === uid)
    if (subIndex === -1) {
      //console.log("No subscription found for ",uid)
      return
    }
    var sub = _subs[subIndex]
    var rqParam = sub.rqParam
    rqParam.replace('subscribeCandles', 'unsubscribeCandles')

    try {
      socket.send(rqParam);
    } catch (error) {
      console.error('error', error);
    }

    _subs.splice(subIndex, 1)
  }
}

socket.onopen = function open() {
  console.log('===Socket connected')
};

socket.onclose = function close() {
  console.log('===Socket disconnected')
};

socket.onerror = function error() {
  console.log('====socket error')
};
socket.onmessage = function incoming(e) {
  var hResponse = JSON.parse(e.data);

  if (hResponse.method == null) {
    return
  }

  //loop response
  hResponse.params.data.map(el => {
    var d = new Date(el.timestamp);
    var timeStamp = d.getTime();
    const data = {
      ts: timeStamp,
      open: el.open,
      close: el.close,
      high: el.max,
      low: el.min,
      volume: el.volume
    }

    const sub = _subs[0]

    if (sub) {
      // disregard the initial catchup snapshot of trades for already closed candles
      if (data.ts < sub.lastBar.time) {
        return
      }

      var _lastBar = updateBar(data, sub)

      // send the most recent bar back to TV's realtimeUpdate callback
      sub.listener(_lastBar)
      // update our own record of lastBar
      sub.lastBar = _lastBar
    }
  })
};

// Take a single trade, and subscription record, return updated bar
function updateBar(data, sub) {
  console.log('Upadte bar.. ', new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''))
  var lastBar = sub.lastBar
  let resolution = sub.resolution
  if (resolution.includes('D')) {
    // 1 day in minutes === 1440
    resolution = 1440
  } else if (resolution.includes('W')) {
    // 1 week in minutes === 10080
    resolution = 10080
  }
  //minute to milisecond
  var coeff = resolution * 60 * 1000
  //round by milisecond
  var rounded = Math.floor(data.ts / coeff) * coeff
  var lastBarMilisec = lastBar.time
  var _lastBar

  if (rounded > lastBarMilisec) {
    console.log('New candle')
    //TODO : Need to confirm
    _lastBar = {
      time: rounded,
      open: data.open,
      high: data.high,
      low: data.low,
      close: data.close,
      volume: data.volume
    }

  } else {
    console.log('Update candle')
    // update lastBar candle!
    if (data.close < lastBar.low) {
      lastBar.low = data.close
    } else if (data.close > lastBar.high) {
      lastBar.high = data.close
    }

    lastBar.volume += data.volume
    lastBar.close = data.close
    _lastBar = lastBar
  }
  return _lastBar
}