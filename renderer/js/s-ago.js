/**
 * `s-ago` module: "This is the smallest, fully unit tested module to convert Date objects into human readable relative timestamps, such as '4 minutes ago', 'yesterday', 'tomorrow', or 'in 3 months'"
 * https://www.npmjs.com/package/s-ago
 * The implementation has been refactored
 */
let format = (diff, divisor, unit, past, future, isInTheFuture) => {
  let val = Math.round(Math.abs(diff) / divisor)

  /**
   * Add support for right-to-left languages
   * This will help with showing the text in the correct way if the language (like Arabic and Hebrew) are read from the right to the left
   */
  try {
    if (I18next.dir() != 'rtl')
      throw 0

    if (!isInTheFuture)
      return (val <= 1) ? I18next.t(past) : I18next.t('ago') + ' ' + val + ' ' + I18next.t(unit)
  } catch (e) {}

  if (isInTheFuture)
    return (val <= 1) ? I18next.t(future) : I18next.t('in') + ' ' + val + ' ' + I18next.t(unit)

  return (val <= 1) ? I18next.t(past) : val + ' ' + I18next.t(unit) + ' ' + I18next.t('ago')
}

module.exports = function ago(date, max) {
  let units = [{
      max: 2760000,
      value: 60000,
      name: 'minute',
      past: 'a minute ago',
      future: 'in a minute'
    },
    {
      max: 72000000,
      value: 3600000,
      name: 'hour',
      past: 'an hour ago',
      future: 'in an hour'
    },
    {
      max: 518400000,
      value: 86400000,
      name: 'day',
      past: 'yesterday',
      future: 'tomorrow'
    },
    {
      max: 2419200000,
      value: 604800000,
      name: 'week',
      past: 'last week',
      future: 'in a week'
    },
    {
      max: 28512000000,
      value: 2592000000,
      name: 'month',
      past: 'last month',
      future: 'in a month'
    } // max: 11 months
  ]

  let diff = Date.now() - date.getTime()

  // less than a minute
  if (Math.abs(diff) < 60000)
    return I18next.capitalizeFirstLetter(I18next.t('just now'))

  for (let i = 0; i < units.length; i++)
    if (Math.abs(diff) < units[i].max || (max && units[i].name === max))
      return I18next.capitalizeFirstLetter(format(diff, units[i].value, units[i].name, units[i].past, units[i].future, diff < 0))

  return I18next.capitalizeFirstLetter(format(diff, 31536000000, I18next.t('year'), I18next.t('last year'), I18next.t('in a year'), diff < 0))
}
