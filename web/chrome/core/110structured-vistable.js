
/**
 * Structured Library
 * @param {object} $ object reference
 */
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD (Register as an anonymous module)
        define(['jquery', 'sfun'], factory);
    } else if (typeof exports === 'object') {
        // Node/CommonJS
        module.exports = factory(require('jquery'), require('sfun'));
    } else {
        // Browser globals
        factory(jQuery, sfun);
    }
}(function ($, sfun) {

    var vistable = {

        // FUNCTIONS

        /**
         * update coordinates stored for a range of cells
         * @param {string} direction x or y
         * @param {int} range_start seq of first cell to refresh
         * @param {int} range_end seq of last cell to refresh (inclusive)
         */
        'updateRange': function (direction, range_start, range_finish) {
            var vt = this;
            // capture initial position of last cell in range (b) to calculate delta-b
            var position_finish_pre = sfun.api_$cell(range_finish).offset();
            // loop through cells from start to finish
            for (var i = range_start; i <= range_finish; ++i) {
                var $ent = sfun.api_$cell(i);
                var position = $ent.offset();
                var ref = $ent.data('seq');
                var obj = vt.select(ref);
                if (position == undefined) {
                    console.log('eeeek');
                }
                if (obj == null) {
                    // add object
                    var obj = {
                        '$ent': $ent,
                        'ref': ref,
                        'key': Math.floor(direction == 'x' ? position.left : position.top)
                    };
                    vt.push(obj);
                } else {
                    // replace this key in object and key index
                    vt.replaceKey(ref, obj, Math.floor(direction == 'x' ? position.left : position.top));
                }
            }
            // calculate delta-b
            var position_finish_post = sfun.api_$cell(range_finish).offset();
            var delta_b = (direction == 'x' ? position_finish_post.left - position_finish_pre.left : position_finish_post.top - position_finish_pre.top);
            // if there's been a shift effect
            if (delta_b != 0) {
                // update all the keys after the updated range to include their new position
                vt.keyShift(range_finish + 1, vt.getSize() - 1, delta_b);
            }
        },

        /**
         * update coordinates stored for each cell
         * @param {string} direction x or y
         * @param {object} $cells jQuery list of cells
         */
        'updateAll': function (direction, $cells) {
            var vt = this;
            // wipe previous table altogether
            vt.wipe();
            // read in new values
            $cells.each(function () {
                var $ent = $(this);
                var position = $ent.offset();
                // create object
                var obj = {
                    '$ent': $ent,
                    'key': Math.floor(direction == 'x' ? position.left : position.top)
                };
                // push object into hashTable
                vt.push(obj);
            });
        },

        /**
         * inc/decrements keys within a range
         * @param  {int} range_start  array ref for start position
         * @param  {int} range_finish array ref for end position (inclusive)
         * @param  {mixed} delta        [description]
         * If keys are strings, this appends a string
         * If keys are numeric, this inc/decrements
         */
        'keyShift': function (range_start, range_finish, delta) {
            for (var i = range_start; i <= range_finish; ++i) {
                if (this.keyarr[i] != null) {
                    this.keyarr[i] += delta;
                    this.objarr[i].key += delta;
                }
            }
        },

        lastEntry: null
    };

    // create new instance function
    vistable.createNew = function() {
        return $.extend( $.createHashTable('visTable'), vistable, {});
    };

    /**
     * The visTableMajor is used:
     * - to store an indexed list of cell coordinates along the major axis
     */
    sfun.api_coreExtend({

        'visTableMajor': vistable.createNew()

    });

}));
