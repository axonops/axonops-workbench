/**
 * @license jQuery-mutate
 * Licensed under the MIT license
 * http://www.opensource.org/licenses/mit-license.php
 */
(function($) {
  mutate_event_stack = [{
      name: 'width',
      handler: function(n) {
        let e = $(n)

        if (!e.data('mutate-width'))
          e.data('mutate-width', e.width())

        if (e.data('mutate-width') && e.width() != e.data('mutate-width')) {
          e.data('mutate-width', e.width())

          return true
        }

        return false
      }
    },
    {
      name: 'height',
      handler: function(n) {
        let e = $(n)

        if (!e.data('mutate-height'))
          e.data('mutate-height', e.height())

        if (e.data('mutate-height') && e.height() != e.data('mutate-height')) {
          e.data('mutate-height', e.height())

          return true
        }
      }
    },
    {
      name: 'transform',
      handler: function(n) {
        let e = $(n)

        if (!e.data('mutate-transform'))
          e.data('mutate-transform', e.css('transform'))

        if (e.data('mutate-transform') && e.css('transform') != e.data('mutate-transform')) {
          e.data('mutate-transform', e.css('transform'))

          return true
        }
      }
    },
    {
      name: 'top',
      handler: function(n) {
        let e = $(n)

        if (!e.data('mutate-top'))
          e.data('mutate-top', e.css('top'))

        if (e.data('mutate-top') && e.css('top') != e.data('mutate-top')) {
          e.data('mutate-top', e.css('top'))

          return true
        }
      }
    },
    {
      name: 'bottom',
      handler: function(n) {
        let e = $(n)

        if (!e.data('mutate-bottom'))
          e.data('mutate-bottom', e.css('bottom'))

        if (e.data('mutate-bottom') && e.css('bottom') != e.data('mutate-bottom')) {
          e.data('mutate-bottom', e.css('bottom'))

          return true
        }
      }
    },
    {
      name: 'right',
      handler: function(n) {
        let e = $(n)

        if (!e.data('mutate-right'))
          e.data('mutate-right', e.css('right'))

        if (e.data('mutate-right') && e.css('right') != e.data('mutate-right')) {
          e.data('mutate-right', e.css('right'))

          return true
        }
      }
    },
    {
      name: 'left',
      handler: function(n) {
        let e = $(n)

        if (!e.data('mutate-left'))
          e.data('mutate-left', e.css('left'))

        if (e.data('mutate-left') && e.css('left') != e.data('mutate-left')) {
          e.data('mutate-left', e.css('left'))

          return true
        }
      }
    },
    {
      name: 'hide',
      handler: function(n) {
        let e = $(n),
          isHidden = e.is(':hidden'),
          prevHidden = e.data('prev-hidden') == undefined ? isHidden : e.data('prev-hidden')

        e.data('prev-hidden', isHidden)

        if (isHidden && isHidden != prevHidden)
          return true
      }
    },
    {
      name: 'show',
      handler: function(n) {
        let e = $(n)

        let isVisible = e.is(':visible'),
          prevVisible = e.data('prev-visible') == undefined ? isVisible : e.data('prev-visible')

        e.data('prev-visible', isVisible)

        if (isVisible && isVisible != prevVisible)
          return true
      }
    },
    {
      name: 'scrollHeight',
      handler: function(n) {
        let e = $(n)

        if (!e.data('prev-scrollHeight'))
          e.data('prev-scrollHeight', e[0].scrollHeight)

        if (e.data('prev-scrollHeight') && e[0].scrollHeight != e.data('prev-scrollHeight')) {
          e.data('prev-scrollHeight', e[0].scrollHeight)

          return true
        }
      }
    },
    {
      name: 'scrollWidth',
      handler: function(n) {
        let e = $(n)

        if (!e.data('prev-scrollWidth'))
          e.data('prev-scrollWidth', e[0].scrollWidth)

        if (e.data('prev-scrollWidth') && e[0].scrollWidth != e.data('prev-scrollWidth')) {
          e.data('prev-scrollWidth', e[0].scrollWidth)

          return true
        }
      }
    },
    {
      name: 'scrollTop',
      handler: function(n) {
        let e = $(n)

        if (!e.data('prev-scrollTop'))
          e.data('prev-scrollTop', e[0].scrollTop())

        if (e.data('prev-scrollTop') && e[0].scrollTop() != e.data('prev-scrollTop')) {
          e.data('prev-scrollTop', e[0].scrollTop())

          return true
        }
      }
    },
    {
      name: 'scrollLeft',
      handler: function(n) {
        let e = $(n)

        if (!e.data('prev-scrollLeft'))
          e.data('prev-scrollLeft', e[0].scrollLeft())

        if (e.data('prev-scrollLeft') && e[0].scrollLeft() != e.data('prev-scrollLeft')) {
          e.data('prev-scrollLeft', e[0].scrollLeft())

          return true
        }
      }
    }
  ]
  mutate = {
    speed: 100,
    event_stack: mutate_event_stack,
    stack: [],
    events: {},
    add_event: function(evt) {
      mutate.events[evt.name] = evt.handler
    },
    add: function(event_name, selector, callback, false_callback) {
      mutate.stack[mutate.stack.length] = {
        event_name: event_name,
        selector: selector,
        callback: callback,
        false_callback: false_callback
      }
    }
  }

  function reset() {
    let parent = mutate

    if (parent.event_stack != 'undefined' && parent.event_stack.length) {
      $.each(parent.event_stack, function(j, k) {
        mutate.add_event(k)
      })
    }

    parent.event_stack = []

    $.each(parent.stack, function(i, n) {
      $(n.selector).each(function(a, b) {
        if (parent.events[n.event_name](b) === true) {
          if (n['callback'])
            n.callback(b, n)
        } else {
          if (n['false_callback'])
            n.false_callback(b, n)
        }
      })
    })
    setTimeout(reset, mutate.speed)
  }

  reset()

  $.fn.extend({
    mutate: function() {
      let event_name = false,
        callback = arguments[1],
        selector = this,
        false_callback = arguments[2] ? arguments[2] : function() {}

      if (arguments[0].toLowerCase() == 'extend') {
        mutate.add_event(callback)

        return this
      }

      $.each($.trim(arguments[0]).split(' '), function(i, n) {
        event_name = n

        mutate.add(event_name, selector, callback, false_callback)
      })

      return this
    }
  })
})(jQuery)
