/**
 * StructuredFun javascript
 * Loupe
 */
(function ($, sfun, undefined) {

    var tool = {

        // PUBLIC functions

        'init': function () {
            var obj = {
                'context': this,
                'receiverRegistered': this._bindToTemplate,
                'view': {
                    'title': 'Loupe'
                },
                'template': this._getTemplate()
            };
            // once script is loaded and executes, push header button async
            sfun.push('headerAddButton', obj);
        },

        'show': function () {
            this.__showing = true;
            // attach div to page and read back
            $('html').append(this._render());
            this.__$loupe = $('#loupe');
            // get current image
            var seq = sfun.api_getSeq();
            var $img = sfun.api_getCell(seq).find('img');
            // substitute with maxwidth and maxheight unset to get native (/!,/)
            var img_path = sfun.api_substitute($img.data('template-src'), {});
            // [fire loading request to] load image into loupe
            console.log(img_path);
        },

        'hide': function () {
            this.__showing = true;
            // destroy DOM element
            this.__$loupe.remove();
        },

        // PRIVATE functions and CONSTANTS

        __showing: false,

        _getTemplate: function () {
            var str = '<li><a href="#" id="header-loupe">{{ title }}</a></li>';
            return str;
        },

        _bindToTemplate: function (obj) {
            $('#header-loupe').click(this._getClickHandler());
        },

        _getClickHandler: function () {
            var that = this;
            return (function (event) {
                if (that.__showing) {
                    that.hide();
                } else {
                    that.show();
                }
                event.preventDefault();
            });
        },

        _render: function () {
            var html = '<div id="loupe">';
            html += '</div>';
            return html;
        },

        // no comma on last entry
        __lastEntry: true
    };

    // call init function
    tool.init();

})(jQuery, window.sfun, undefined);