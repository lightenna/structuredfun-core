/**
 * StructuredFun javascript
 * refresh: a link to refresh the folder view
 */
(function ($, sfun, undefined) {

    // ---------
    // CONSTANTS
    // ---------

    var debug = true;
    var $document = $(document);
    var $html = $('html');
    var $button = null;
    var view = {
        'title': 'Refresh',
    };

    // -----
    // STATE
    // -----

    // ---------
    // FUNCTIONS
    // ---------

    var init = function () {
        var obj = {
            'context': this,
            'key': 'refresh',
            'receiverRegistered': refresh_receiverRegistered,
            'view': view,
            'template': _getTemplate(),
        };
        // not sure of init order, so push async
        sfun.push('headerAddButton', obj);
    };

    /**
     * called by sfun when ready
     */
    var refresh_receiverRegistered = function () {
        $button = $('#header-refresh');
        // bind to header button
        $button.click(_getClickHandler());
    };

    //
    // FUNCTIONS: Helpers
    // begin _
    //

    var _getTemplate = function () {
        var str = '<li><a href="#" id="header-refresh">{{ title }}</a></li>';
        return str;
    };

    var _getClickHandler = function () {
        return (function (event) {
            _refresh();
            event.preventDefault();
        });
    };

    var _refresh = function () {
        // work out where we want to go
        var newurl = sfun.api_getNewUrlForCurrentIdentifier('/filecacherefresh', true);
        if (newurl) {
            console.log(newurl);
            sfun.api_redirect(newurl);
        }
    };

    // call init function
    init();

})(jQuery, window.sfun, undefined);
