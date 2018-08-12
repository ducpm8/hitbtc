var rp = require('request-promise').defaults({ json: true })

const api_root = 'https://api.hitbtc.com'
const history = {}

export default {
	history: history,

	getBars: function (symbolInfo, resolution, from, to, first, limit) {
		const url = '/api/2/public/candles/BTCUSD'
		var charPendix = 'M'
		if (resolution === 'D') {
			charPendix = resolution + '1'
		} else if (resolution > 30 && resolution <= 240) {
			charPendix = 'H' + resolution / 60
		} else {
			charPendix = 'M' + resolution
		}
		const qs = {
			limit: limit ? limit : 1000,
			period: charPendix
		}

		return rp({
			method: 'GET',
			resolveWithFullResponse: true,
			uri: `${api_root}${url}`,
			qs: qs
		})
			.then(data => {
				//TODO : Need to correct
				if (data.Response && data.Response === 'Error') {
					console.log('CryptoCompare API error:', data.Message)
					return []
				}
				if (data.body.length) {
					var bars = data.body.map(el => {
						var d = new Date(el.timestamp);
						var timeStamp = d.getTime();

						return {
							time: timeStamp, //TradingView requires bar time in ms
							low: el.min,
							high: el.max,
							open: el.open,
							close: el.close,
							volume: el.volume
						}
					})
					if (first) {
						var lastBar = bars[bars.length - 1]
						history[symbolInfo.name] = { lastBar: lastBar }
					}
					return bars
				} else {
					return []
				}
			})
			.catch((err) => {
				console.log("oh no: " + err)
			});
	}
}
