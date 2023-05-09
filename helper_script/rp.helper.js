const rp = require('request-promise')

module.exports.origRp = async (options) => {
  return rp(options)
}
