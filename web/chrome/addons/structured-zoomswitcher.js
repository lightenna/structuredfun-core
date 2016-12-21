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
        var str = '<li><a href="#" id="header-switcher-zoom">{{ title_zoom }}</a> | <a href="#" id="header-switcher-file">{{ title_file }}</a></li>';
        return str;
    };

    var _getClickHandler = function (target) {
        return (function (event) {
            var newurl = sfun.api_getNewUrlForCurrentIdentifier(target, true);
            if (newurl) {
                // redirect to current URL with
                console.log(target);
                sfun.api_redirect(newurl);
            }
            event.preventDefault();
        });
    };

    // call init function
    init();

})(jQuery, window.sfun, undefined);
