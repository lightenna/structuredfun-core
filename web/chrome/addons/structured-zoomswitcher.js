/**
 * StructuredFun javascript
 * zoomswitcher: a simple mechanism for moving between zoom/non-zoomy layouts
 */
(function ($, sfun, undefined) {

    // ---------
    // CONSTANTS
    // ---------

    var debug = true;
    var $document = $(document);
    var $html = $('html');
    var $button_zoom = null;
    var $button_file = null;
    var view = {
        'title_zoom': 'Zoom',
        'title_file': 'File',
    };

    // -----
    // STATE
    // -----

    var zooming = false;

    // ---------
    // FUNCTIONS
    // ---------

    var init = function () {
        var obj = {
            'context': this,
            'key': 'zoomswitcher',
            'receiverRegistered': zs_receiverRegistered,
            'view': view,
            'template': _getTemplate(),
        };
        // not sure of init order, so push async
        sfun.push('headerAddButton', obj);
    };

    /**
     * called by sfun when ready
     */
    var zs_receiverRegistered = function () {
        $button_zoom = $('#header-switcher-zoom');
        $button_file = $('#header-switcher-file');
        // bind to header buttons
        $button_zoom.click(_getClickHandler('/zoom'));
        $button_file.click(_getClickHandler('/file'));
    };

    //
    // FUNCTIONS: Helpers
    // begin _
    //

    var _getTemplate = function () {
        var str = '<p><a href="#" id="header-switcher-zoom">{{ title_zoom }}</a> | <a href="#" id="header-switcher-file">{{ title_file }}</a></p>';
        return str;
    };

    var _getClickHandler = function (target) {
        return (function (event) {
            var slashpos = window.location.pathname.indexOf('/', 1);
            if (slashpos > 0) {
                // pull current URL
                var newurl = target + window.location.pathname.substring(slashpos) + window.location.hash;
                // debugging
                console.log(newurl);
                // redirect to current URL with
                _redirect(newurl);
            }
            event.preventDefault();
        });
    };

    var _redirect = function (target) {
        console.log(target);
        // simple javascript redirect
        window.location = target;
    };

    // call init function
    init();

})(jQuery, window.sfun, undefined);
