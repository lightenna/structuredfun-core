/**
 * StructuredFun javascript
 * showfolder: a link to show the original folder
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
        'title': 'Folder',
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
            'key': 'showfolder',
            'receiverRegistered': showfolder_receiverRegistered,
            'view': view,
            'template': _getTemplate(),
        };
        // not sure of init order, so push async
        sfun.push('headerAddButton', obj);
    };

    /**
     * called by sfun when ready
     */
    var showfolder_receiverRegistered = function () {
        $button = $('#header-showfolder');
        // bind to header button
        $button.click(_getClickHandler());
    };

    //
    // FUNCTIONS: Helpers
    // begin _
    //

    var _getTemplate = function () {
        var str = '<li><a href="#" id="header-showfolder">{{ title }}</a></li>';
        return str;
    };

    var _getClickHandler = function () {
        return (function (event) {
            _show();
            event.preventDefault();
        });
    };

    /**
     * dynamically create URL file and prompt for download/run
     * from http://stackoverflow.com/questions/5246292/open-local-folder-from-link
     */
    function _download(filename, text) {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    var _show = function () {
        // work out where we want to go
        var newurl = sfun.api_getNewUrlForCurrentIdentifier('/explorer', true);
        if (newurl) {
            // download URL file method
            // _download('folder-link.url','[InternetShortcut]'+"\r\n"+'URL=file:///D:/');
            // ping ajax request to local server
            $.ajax(newurl);
        }
    };

    // call init function
    init();

})(jQuery, window.sfun, undefined);
