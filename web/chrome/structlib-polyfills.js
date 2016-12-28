
// ---------
// POLYFILLS
// ---------

// Object.create polyfill
if (typeof Object.create !== 'function') {
    Object.create = function (o) {
        function F() {
        }

        F.prototype = o;
        return new F();
    };
}

// inherits polyfill
if (typeof Function.prototype.inherits !== 'function') {
    // helper that makes inheritance work using 'Object.create'
    Function.prototype.inherits = function (parent) {
        this.prototype = Object.create(parent.prototype);
    };
}

// missing console in IE
var console = window.console || {
        log: function () {
        }
    };

/**
 * Structured Library
 * @param {object} $ object reference
 */
(function ($, undefined) {

    // ---------
    // POLYFILLS
    // ---------

    // jQuery selector refresh
    $.fn.refresh = function () {
        return $(this.selector);
    };

    // jQuery caching find function
    $.fn.cachedFind = function (subselector) {
        this.litter = this.litter || {};
        this.litter.cache = this.litter.cache || {};
        if (this.litter.cache[subselector] == undefined) {
            if (false) {
                console.log('cache HIT (' + this.selector + ') id[' + this.attr('id') + ']:' + subselector);
            }
            this.litter.cache[subselector] = this.find(subselector);
        }
        else {
            if (false) {
                console.log('cache MISS (' + this.selector + ') id[' + this.attr('id') + ']:' + subselector);
            }
        }
        return this.litter.cache[subselector];
    };

    // jQuery caching getter
    $.fn.cachedGet = function (key) {
        this.litter = this.litter || {};
        this.litter.cache = this.litter.cache || {};
        return this.litter.cache[key];
    }

    // jQuery caching setter
    $.fn.cachedSet = function (key, value) {
        this.litter = this.litter || {};
        this.litter.cache = this.litter.cache || {};
        this.litter.cache[key] = value;
    }

})(jQuery, undefined);