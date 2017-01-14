/**
 * StructuredFun javascript
 * QUnit test harness
 */
(function ($, sfun, undefined) {

    // ---------
    // CONSTANTS
    // ---------

    // ---------
    // FUNCTIONS
    // ---------

    var init = function () {
        var obj = {
            'context': this,
            'receiverRegistered': bindToTemplate,
            'view': {
                'title': 'Test'
            },
            'template': getTemplate()
        };
        // once script is loaded and executes, push header button async
        sfun.push('headerAddButton', obj);
    };

    var getTemplate = function () {
        var str = '<li class="debug-only"><a href="#" id="header-test-single">{{ title }}</a></li>';
        return str;
    };

    var bindToTemplate = function (obj) {
        $('#header-test-single').click(getClickHandler());
    };

    var getClickHandler = function () {
        return (function (event) {
            // write QUnit harness into page
            var qs = '<div id="qunit"></div><div id="qunit-fixture"></div>';
            $('body').prepend(qs);
            // pull in QUnit library (triggers scroll:x=0&y=0)
            $.getScript("/chrome/vendor/qunit/qunit-1.14.0.min.js").done(function () {
                // execute tests
                tests();
            });
            event.preventDefault();
        });
    };

    // -----
    // TESTS
    // -----

    /**
     * execute tests
     */
    var tests = function () {
        QUnit.init();
        var resetTestMarker = '#!';
        var resetTest = function () {
            window.location.hash = resetTestMarker;
        };

        test('check vistable refresh', function () {
            resetTest();
            var direction = sfun.api_getDirection();
            var breadth = sfun.api_getBreadth();
            var vt = sfun.api_createVisTable();
            var vt_partial = sfun.api_createVisTable();
            var $cells = $('ul.flow .selectablecell');
            if ($cells.length < (4 * breadth)) {
                ok(false, "Not enough cells " + $cells.length + "to conduct test");
            } else {
                var ref3 = 2 * breadth, ref4 = 3 * breadth;
                var off3 = $cells.eq(ref3).offset(), off4 = $cells.eq(ref4).offset();
                var major3 = Math.floor(direction == 'x' ? off3.left : off3.top), major4 = Math.floor(direction == 'x' ? off4.left : off4.top);
                // update all vis table entries
                vt.updateAll(direction, $cells);
                // look for major3 and major4 to check mid-array load
                equal(vt.findCompare(major3, sfun.compareGTE), ref3, 'vistable found major 3 at ref 3');
                equal(vt.findCompare(major4, sfun.compareGTE), ref4, 'vistable found major 4 at ref 4');
                // update only some entries in vt_partial
                // this creates a sparse array, which isn't typical
                vt_partial.updateRange(direction, ref3, ref4);
                // look for first and last to check partials
                equal(vt_partial.findCompare(0, sfun.compareGTE), ref3, 'vistable found ref 3 >= 0');
                equal(vt_partial.findCompare(9999, sfun.compareLTE), ref4, 'vistable found ref 4 <= 9999');
                // imagine we expand the size of column 3 and calculate delta_b
                var delta_b = 50;
                // apply delta to affected cells
                vt_partial.keyShift(ref4, vt_partial.getSize() - 1, delta_b);
                // check update
                var major4b = vt_partial.select(ref4).key;
                equal(major4b, major4 + delta_b, 'delta correctly applied to post range cells');
            }
            resetTest();
        });

        QUnit.start();
    };

    // call init function
    init();

})(jQuery, window.sfun, undefined);