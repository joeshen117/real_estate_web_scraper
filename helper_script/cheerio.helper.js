module.exports.getTextFrom = ($from) => (selector) => {
  const $el = $from.find(selector)
  return $el.length ? $el.text() : null
}

module.exports.getAttrFrom = ($from) => (selector, attr) => {
  const $el = $from.find(selector)
  return $el.length > 0 ? $el.attr(attr) : null
}

module.exports.doesFindFrom = ($from) => (selector) => {
  const $doesFind = $from.find(selector)
  return $doesFind.length > 0
}