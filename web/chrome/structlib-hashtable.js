
/**
 * Structured Library
 * @param {object} $ object reference
 */
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD (Register as an anonymous module)
        define(['jquery'], factory);
    } else if (typeof exports === 'object') {
        // Node/CommonJS
        module.exports = factory(require('jquery'));
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {

    /**
     * create a generic hashTable
     * @param {string} namearg name of the table (used for debugging messages)
     * @return {object} hashTable object
     */
    var hashtable = $.createHashTable = function(namearg) {

        if (typeof(namearg) == 'undefined') {
            namearg = '<unnamed>';
        }
        return {
            // optional name
            'name': namearg,
            // array of objects, stored in dense sequential
            'objarr': [],
            // array of keys, stored in dense sequential
            'keyarr': [],

            // length of queue
            'length': 0,
            // counter for dishing out unique IDs
            'counter': 0,

            /**
             * @param {array} arr Array of elements to push into hash table
             */
            'add': function (arr) {
                // loop through array adding elements
                for (var i = 0; i < arr.length; ++i) {
                    var obj = arr[i];
                    // if element isn't an object already
                    if (typeof(obj) != 'object') {
                        // create an object wrapper for this key
                        obj = {};
                        obj.key = arr[i];
                    }
                    // push into hash table
                    this._push(obj);
                }
            },

            /**
             * wipe the hash table
             */
            'wipe': function () {
                this.objarr.length = 0;
                this.keyarr.length = 0;
                // don't reset counter because old objects may still be floating about
            },

            /**
             * interface function push obj onto queue
             * this function may be overwritten by specialist hash tables
             * @param {object} obj to push
             */
            'push': function (obj) {
                this._push(obj);
                return obj;
            },

            /**
             * actually push obj onto queue
             * @param {object} obj to push
             */
            '_push': function (obj) {
                // get next free position, but don't store in obj because it can change
                var ref = this.getSize();
                // if object has ref set, use instead
                if (obj.ref != undefined) {
                    ref = obj.ref;
                }
                // store ID and ready for next ID request
                obj.idx = 1000 + this.counter++;
                // store in object array
                this.objarr[ref] = obj;
                // store in the index array(s), allow duplicate keys
                this.keyarr[ref] = obj.key;
                // optional debugging
                if (false) {
                    console.log('pushed object[' + this.render(obj) + '] on to ref[' + ref + '] ' + this.name + ' hashTable, now has ' + this.getSize() + 'elements');
                }
                return ref;
            },

            /**
             * @return {string} render simple string of object
             */
            'render': function (obj) {
                if (obj == null) {
                    return '<no object>';
                }
                return obj.key;
            },

            /**
             * @param {mixed} key to search for
             * @param {bool} [findLast] true to find last occurrence of this key
             * @return {int} array reference or -1 if not found
             */
            'find': function (key, findLast) {
                var ref;
                // set defaults on optional arguments
                if (typeof(findLast) == 'undefined') {
                    findLast = false;
                }
                if (findLast) {
                    ref = this.keyarr.lastIndexOf(key);
                } else {
                    ref = this.keyarr.indexOf(key);
                }
                return ref;
            },

            /**
             * @param {mixed} key to search for, as regular expression without slashes
             * @param {bool} [findLast] true to find last occurrence of this key
             * @return {int} array reference or -1 if not found
             */
            'findRegex': function (key, findLast) {
                var ref;
                // set defaults on optional arguments
                if (typeof(findLast) == 'undefined') {
                    findLast = false;
                }
                // prep search loop
                var re = new RegExp(key, 'g');
                $matches = [];
                for (var i = 0; i < this.keyarr.length; i++) {
                    // try and match the key against this key
                    if (this.keyarr[i].match(re) != null) {
                        // store position of match
                        ref = i;
                        if (!findLast) {
                            // if we're not looking for the last one, break at the first match
                            break;
                        }
                    }
                }
                return ref;
            },

            /**
             * @param {mixed} key to pivot around
             * @param {int} increment positive for >=, negative for <=
             * @param {bool} [findLast] true to find last occurrence of this key
             * @return {int} ref position of object matching this comparison, or -1 if not found
             */
            'findCompare': function (key, comparison, findLast) {
                // set defaults on optional arguments
                if (typeof(findLast) == 'undefined') {
                    findLast = false;
                }
                // find boundaries of array
                var minRef = 0;
                // detect sparse array
                if (this.keyarr[minRef] == undefined) {
                    for (var i in this.keyarr) {
                        // array keys returned as strings, so convert
                        minRef = parseInt(i);
                        break;
                    }
                }
                var maxRef = this.getSize() - 1;
                // setup binary search
                var currentRef;
                var currentElement;
                while (minRef <= maxRef) {
                    // find middle ref, and element's value
                    currentRef = (minRef + maxRef) / 2 | 0;
                    currentElement = this.keyarr[currentRef];

                    // if less than key
                    if (currentElement < key) {
                        // raise min to current+1
                        minRef = currentRef + 1;
                    }
                    // if greater than key
                    else if (currentElement > key) {
                        // lower max to current-1
                        maxRef = currentRef - 1;
                    }
                    // if equal
                    else {
                        // converge on current
                        minRef = maxRef = currentRef;
                        break;
                    }
                }
                // process based on direction of comparison (LTE/GTE)
                if (comparison > 0) {
                    if (minRef < 0 || minRef >= this.getSize()) return -1;
                    currentElement = this.keyarr[minRef];
                    // work forwards looking for identical value to first >= key
                    return this.find(currentElement, false);
                } else {
                    if (maxRef < 0 || maxRef >= this.getSize()) return -1;
                    currentElement = this.keyarr[maxRef];
                    // work backwards looking for identical value to last <= key
                    return this.find(currentElement, true);
                }
            },

            /**
             * update key for a given object
             * @param {int} ref position in object array
             * @param {objext} obj object to update
             * @param {mixed} new_key
             */
            'replaceKey': function (ref, obj, new_key) {
                if (this.objarr[ref] == obj) {
                    // upate object itself
                    obj.key = new_key;
                    // update key array
                    this.keyarr[ref] = new_key;
                }
            },

            /**
             * Could use any object property to dereference it (like ID)
             * @param {object} object to remove if found
             * @return {int} array reference if removed or -1 if not found
             */
            'removeObj': function (obj) {
                // use key to deref object
                return this.removeKey(obj.key);
            },

            /**
             * @param {string} key to remove if found
             * @return {int} array reference if removed or -1 if not found
             */
            'removeKey': function (key) {
                // find this key in the array
                var ref = this.find(key);
                if (ref != -1) {
                    var obj = this.objarr[ref];
                    this.removeRef(ref);
                    // optional debugging output
                    if (false) {
                        console.log('removed [' + this.render(obj) + '] from ' + this.name + ' hashTable');
                    }
                }
                return ref;
            },

            /**
             * @param {int} ref to remove
             */
            'removeRef': function (ref) {
                // delete from the object array
                this.objarr.splice(ref, 1);
                // delete from the index array
                this.keyarr.splice(ref, 1);
            },

            /**
             * This can be used just prior to a _push to get the ID that will be assigned by that _push
             * @return {int} object counter in the hashTable
             */
            'getCounter': function () {
                return this.counter;
            },

            /**
             * @return {int} total number of entries in table
             */
            'getSize': function () {
                return this.objarr.length;
            },

            /**
             * interface function to get from table
             * @param {string} key to search for
             * @param {bool} [alsoRemove] true to delete matched elements
             * @param {bool} [findLast] true to find last occurrence of this key
             * @return {object} matched object or null if not found
             */
            'get': function (key, alsoRemove, findLast) {
                // set defaults on optional arguments
                if (typeof(alsoRemove) == 'undefined') {
                    alsoRemove = false;
                }
                if (typeof(findLast) == 'undefined') {
                    findLast = false;
                }
                return this._get(key, alsoRemove);
            },

            /**
             * actually get object from table
             * @param {string} key to search for
             * @param {bool} [alsoRemove] true to delete matched elements
             * @param {bool} [findLast] true to find last occurrence of this key
             * @return {object} matched object or null if not found
             */
            '_get': function (key, alsoRemove, findLast) {
                // set defaults on optional arguments
                if (typeof(alsoRemove) == 'undefined') {
                    alsoRemove = false;
                }
                if (typeof(findLast) == 'undefined') {
                    findLast = false;
                }
                // find position in array(s)
                var ref = this.find(key, findLast);
                if (false) {
                    console.log('get requested for key[' + key + ']');
                }
                if (ref != -1) {
                    // get the object
                    var obj = this.objarr[ref];
                    if (alsoRemove) {
                        // delete this object
                        this.removeRef(ref);
                        if (false) {
                            console.log('pulled hashTable object[' + this.render(obj) + ']');
                        }
                    }
                    return obj;
                }
                return null;
            },

            /**
             * get the object at a certain position in the table
             * @param {int} ref position in table
             * @return {object} matched object, or null if not present
             */
            'select': function (ref) {
                if ((ref == -1) || (ref >= this.objarr.length)) {
                    return null;
                }
                return this.objarr[ref];
            },

            /**
             * get the key on an object at a certain position in the table
             * @param {int} ref position in table
             * @return {mixed} key at this position in the table
             */
            'key': function (ref) {
                if ((ref == -1) || (ref >= this.objarr.length)) {
                    return null;
                }
                return this.keyarr[ref];
            },

            /**
             * @param {function} func function to call on all objects in hashTable
             */
            'iterate': function (func) {
                for (var i = 0; i < this.objarr.length; i++) {
                    var obj = this.objarr[i];
                    func(obj);
                }
            },

            lastEntry: null
        };
    }
}));
