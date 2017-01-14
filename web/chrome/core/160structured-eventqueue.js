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

    var local_vis = {

        // reference from visualisation to actual event queue
        eventQueue: null,

        // cached jquery object for visualisation list in DOM <ul>
        $vislist: null,

        // timeout function for next unprompted refresh
        vissched_timeout_static: null,

        // time to next unprompted refresh (typically 2s)
        vissched_time_to_next_default: 2000,
        vissched_time_to_next: 2000,

        /**
         * @param string action
         * @param string object [of action] identifier
         */
        _log: function (action, object) {
            var action = action + '[' + (object % 1000) + ']';
            if (sfun.api_getDebug() && false) {
                console.log(action);
            }
        },

        /**
         * @return function click handler in this context
         */
        _clickHandler: function () {
            var that = this;
            return function (event) {
                if (sfun.api_getDebug() && true) {
                    console.log('Event queue current status:');
                }
                // iterate over entire event queue
                that.eventQueue.iterate(function (obj) {
                    if (sfun.api_getDebug() && true) {
                        console.log(obj);
                    }
                });
            };
        },

        _refresh: function () {
            // iterate from critical_section up to produce list of queued events
            // i.e. the current critical and its parents
            var queued_list = this._buildParentList(this._critical_section);
            if (sfun.api_getDebug() && false) {
                console.log('queued');
                console.log(queued_list);
            }
            // hash the 'queued' list so we can easily do look-ups in it
            var queued_hashtable = this._hashList(queued_list);
            // iterate through whole eventQueue looking for events not yet queued
            var unqueued_list = [];
            this.eventQueue.iterate(function (obj) {
                var lookup_id = obj.idx
                // if this event hasn't been queued (parent to current critical section)
                if (queued_hashtable.arr.indexOf(lookup_id) == -1) {
                    // add to unqueued list
                    unqueued_list[unqueued_list.length] = obj;
                }
            });
            if (sfun.api_getDebug() && false) {
                console.log('unqueued');
                console.log(unqueued_list);
            }
            // hash the 'unqueued' list so we can easily do look-ups in it
            var unqueued_hashtable = this._hashList(unqueued_list);
            // find anything that's previously been rendered, but is no longer in the eventQueue
            var $recent_history_list = [];
            var $active_list = this.$vislist.find('li.queued, li.unqueued');
            $active_list.each(function () {
                var lookup_id = $(this).data('key');
                // if this item isn't in either the queued event list, or the unqueued event list
                if ((queued_hashtable.arr.indexOf(lookup_id) == -1) && (unqueued_hashtable.arr.indexOf(lookup_id) == -1)) {
                    $recent_history_list[$recent_history_list.length] = $(this).removeClass('queued unqueued').addClass('history');
                }
            });
            this.$vislist.find('li.title').remove();
            // clear the previous queued and unqueued (future) events
            $active_list.detach();
            // render lists (oldest to newest, bottom up)
            this._renderList('history', 'history', $recent_history_list);
            this._renderList('queued', 'queued', queued_list);
            this._renderList('future', 'unqueued', unqueued_list);
        },

        _renderListItemIDBlock: function (current) {
            var block = '<span class="dig3" title="' + current.key + '">';
            block += (current.fired ? 'TX' : 'RX') + '&nbsp;';
            block += sfun.api_pad(current.idx % 1000, 3);
            block += '</span>';
            return block;
        },

        _renderListItem: function (list_name, current) {
            // build list item
            var type = 'generic_event';
            var keypart = current.key.split(':');
            if (keypart.length) {
                type = keypart[0];
            }
            // build parent list for this item
            var parent_list = this._buildParentList(current.parent);
            var parent_block = '';
            for (var k = 0; k < parent_list.length; ++k) {
                parent_block += '<span class="' + this._getEventType(parent_list[k]) + '">';
                parent_block += this._renderListItemIDBlock(parent_list[k]);
                parent_block += '</span>';
            }
            // build DOM element
            var itemhtml = '<li class="' + list_name + ' ' + this._getEventType(current) + '" data-key="' + current.key + '">';
            itemhtml += parent_block;
            itemhtml += this._renderListItemIDBlock(current);
            itemhtml += current.key;
            itemhtml += '</li>';
            return itemhtml;
        },

        _renderList: function (title, list_class, list) {
            // iterate through list
            for (var j = 0; j < list.length; ++j) {
                var current = list[j];
                if (current instanceof jQuery) {
                    this.$vislist.prepend(current);
                } else {
                    // render event to object
                    var item_html = this._renderListItem(list_class, list[j]);
                    // append to list
                    this.$vislist.prepend(item_html);
                }
            }
            // then show title (at top because of prepend)
            if (title) {
                // append an item to flag this sublist
                this.$vislist.prepend('<li class="title">' + title + '</li>');
            }
        },

        _hashList: function (list) {
            var hashtable = {last_i: 0, arr: []};
            // iterate through list
            for (var j = 0; j < list.length; ++j) {
                // insert into hashtable
                hashtable.arr[hashtable.arr.length] = list[j].idx;
            }
            return hashtable;
        },

        _getEventType: function (current) {
            var type = 'generic_event';
            if ((current.key === undefined) || (current.key === null)) {
                return type;
            }
            var keypart = current.key.split(':');
            if (keypart.length) {
                type = keypart[0];
            }
            return type;
        },

        _buildParentList: function (current) {
            var list = [];
            for (var j = 0; j < sfun.loopIterLIMIT && current != null; ++j, current = current.parent) {
                list[list.length] = current;
            }
            return list;
        },

        _scheduleNextUnpromptedRefresh: function (donext) {
            // cancel if already scheduled
            if (this.vissched_timeout_static !== null) {
                clearTimeout(this.vissched_timeout_static);
            }
            if (donext !== false) {
                if (this.$vislist !== null) {
                    var $listitem = this.$vislist.find('li');
                    // if we have a list, reschedule
                    if ($listitem.length) {
                        var that = this;
                        this.vissched_timeout_static = setTimeout(function () {
                            // default the next refresh back to 2s
                            that.vissched_time_to_next = that.vissched_time_to_next_default;
                            // do the refresh
                            that.refresh();
                        }, this.vissched_time_to_next);
                    }
                }
            }
        },

        // PUBLIC functions

        /**
         * @param {object} event queue
         */
        'init': function (evq) {
            this.eventQueue = evq;
        },

        /**
         * @param boolean true to show visualisation (default), false to hide
         */
        'display': function (show) {
            if (show == undefined) {
                show = true;
            }
            // find list if not cached
            if (this.$vislist == null) {
                // if it doesn't exist and we're displaying it
                if (show) {
                    this.$vislist = $('#eventQueueVis');
                    // build list if not found
                    if (this.$vislist.length == 0) {
                        $('html').append('<ol class="queue" id="eventQueueVis"></ol>');
                        this.$vislist = $('#eventQueueVis');
                        this.$vislist.click(this._clickHandler());
                    }
                }
            } else {
                // if it does exist and we're hiding it
                if (!show) {
                    // remove vislist from screen
                    this.$vislist.remove();
                    this.$vislist = null;
                    // deschedule next update altogether
                    this._scheduleNextUnpromptedRefresh(false);
                }
            }
        },

        /**
         * refresh event queue visualisation
         * @param [string] action
         * @param [string] object [of action] identifier
         */
        'refresh': function () {
            // process optional arguments if set
            if (arguments.length >= 2) {
                this._log(arguments[0], arguments[1]);
            }
            var that = this, wrapUp = function() {
                if (that.$vislist !== null) {
                    that.$vislist.removeClass('refreshing');
                }
                // schedule/re-schedule next refresh (last thing we do)
                that._scheduleNextUnpromptedRefresh();
            };
            // make sure list is visible
            this.display(true);
            // lock list to avoid concurrent refreshes
            if (this.$vislist.hasClass('refreshing')) {
                // currently mid-refresh, but schedule the next one really soon after completion
                this.vissched_time_to_next = 10;
                return;
            }
            this.$vislist.addClass('refreshing');
            // split event queue into sublists and render
            this._refresh();
            // release lock on vis, but asynchronously to make the pulsing CSS work
            setTimeout(wrapUp,5);
        },

        lastEntry: null
    };

    sfun.api_coreExtend({

        /**
         * create a specialised hashTable for the eventQueue
         * {object} hashTable object
         */
        'eventQueue': $.extend($.createHashTable('eventQueue'), {

            // default event object
            _default_event_object: {
                'key': '<unset:',
                // don't replace the event handler
                'replaceEvent': null,
                // don't create a deferred
                'deferred': null,
                // has no parent
                'parent': null,
                // has no dependencies
                'deps': null,
                // has not been handled yet
                'handled': false,
                // was not fired by us explicitly
                'fired': false,
                // can not be dumped if peered
                'dumpable': false,
                // has no action
                'action': function () {
                },
                // never expires
                'expires': null,
                // comment is an empty string (for rendering)
                'comment': '',
                // no id yet
                'idx': null
                // 'animatable' not defined
            },

            // store local reference to visualisation
            _vis: local_vis,

            // expiry timeout callback
            _expiry_handler: null,

            // currently executing event
            _critical_section: null,

            // and the one that just executed
            _last_critical_section: null,

            // count of dumped events
            _dump_count: 0,

            // PRIVATE FUNCTIONS

            /**
             * delay s2 (parent) to follow s1 (child)
             * equivalent to setup parenting from s1 (child) to s2 (parent)
             * @param {object} obj child event context to attach to parent
             * @param {object} parentContext parent event context
             */
            _delay: function (obj, parentContext) {
                var that = this;
                if (typeof(parentContext) != 'undefined' && parentContext) {
                    // attach to parent
                    this._attachParent(obj, parentContext);
                    // optional debugging
                    if (sfun.api_getDebug() && false) {
                        console.log('  - delayed event context[' + this.renderToString(obj.parent) + '] to follow resolution of context[' + this.renderToString(obj) + '], q len now ' + this.getSize());
                    }
                    if (sfun.api_getDebug()) {
                        this._vis.refresh('delay', obj.parent.idx);
                    }
                }
                return obj;
            },

            /**
             * setup parenting from s1 (child) to s2 (parent)
             * @param {object} obj child event context to attach to parent
             * @param {object} parentContext parent event context
             */
            _parent: function (obj, parentContext) {
                var that = this;
                if (typeof(parentContext) != 'undefined' && parentContext) {
                    if (obj.idx == parentContext.idx) {
                        console.log('EEEEK self-parenting');
                    }
                    // child inherits certain parental attributes
                    obj.dumpable = parentContext.dumpable;
                    obj.animateable = parentContext.animateable;
                    obj.replaceEvent = parentContext.replaceEvent;
                    // attach to parent
                    this._attachParent(obj, parentContext);
                    // optional debugging
                    if (sfun.api_getDebug() && false) {
                        console.log('  - placed child event context[' + this.renderToString(obj) + '] into parent context[' + this.renderToString(obj.parent) + '], q len now ' + this.getSize());
                    }
                }
                // return original object, not what actually got attached to parent
                return obj;
            },

            /**
             * setup parenting from s1's earliest ancestor (child) to s2 (parent)
             * @param {object} attach_point [great][grand]child event context
             * @param {object} parentContext parent event context
             * @return {object} s1's ancestor that got attached to parent
             */
            _attachParent: function (attach_point, parentContext) {
                // if this object already had a parent
                if (attach_point.parent != null) {
                    // find its earliest ancestor
                    attach_point = this._earliestAncestor(attach_point);
                }
                // store parent relationship
                attach_point.parent = parentContext;
                // store child relationship
                parentContext.deps[parentContext.deps.length] = attach_point;
                return attach_point;
            },

            /**
             * @param {string} key
             * @return {string} regex pattern to match key's family
             */
            _getKeyFamily: function (key) {
                var colonPos = key.indexOf(':');
                if (colonPos != -1) {
                    return key.substr(0, colonPos + 1) + '.*';
                }
                return key;
            },

            /**
             * @param {object} eventContext to flag as being in its critical section
             */
            _setCriticalSection: function (eventContext) {
                var that = this;
                // setup back-to-one function for use in callbacks
                var scheduleCriticalReset = function () {
                    // if nothing else has swiped it already
                    if (that._critical_section == eventContext) {
                        that._last_critical_section = that._critical_section;
                        // used to flag that nothing is in its critical section
                        // that._critical_section = null;
                        // but that's not accurate
                        // because done() triggers something else to enter its section
                        // yet it never gets set
                        // so instead we just point at parent (which may be null)
                        that._critical_section = that._critical_section.parent;
                        if (sfun.api_getDebug()) {
                            that._vis.refresh('done with criticalSection', that._last_critical_section.idx);
                        }
                    }
                };
                // remember last critical section
                that._last_critical_section = that._critical_section;
                // store eventContext as current critical section
                this._critical_section = eventContext;
                // optional debugging
                if (sfun.api_getDebug() && false) {
                    console.log('> entering critical section for ' + this.renderToString(this._critical_section));
                }
                if (sfun.api_getDebug()) {
                    this._vis.refresh('_setCriticalSection', eventContext.idx);
                }
                this._critical_section.deferred.done(scheduleCriticalReset);
            },

            /**
             * call function, then wrap up its context
             * @param {object} eventContext context to wrap up
             */
            _contextExecute: function (eventContext) {
                var that = this;
                var func = eventContext.action;
                var wrapUp = function () {
                    that.resolve(eventContext);
                };
                if (typeof func == 'function') {
                    // nullify eventContext.action so it cannot be re-called
                    eventContext.action = null;
                    $.when(func.call(eventContext.context)).always(wrapUp);
                } else {
                    wrapUp();
                }
            },

            /**
             * work through ancestor chain, dump similar peers, attach this context
             * @param {object} eventContext context to attach
             */
            _contextDelayExecution: function (eventContext) {
                var that = this;
                // @deprecated remove any peers to this event from the queue first
                // this._dumpAncestors(this._getKeyFamily(eventContext.key), this._critical_section);
                // this event depends on the end of the current critical one's chain
                var lastDep = this._earliestAncestor(this._critical_section);
                // optional debugging message
                if (sfun.api_getDebug() && false) {
                    console.log('_ delaying critical section for ' + this.renderToString(eventContext));
                }
                // set this event up as dependent upon the lastDep (lastDep kicks eventContext)
                this._delay(lastDep, eventContext);
            },

            /**
             * work up through the parents and remove those matching key
             * @param {string} regkey regex pattern to match peers by family
             * @param {object} current root context in parent chain
             */
            _dumpAncestors: function (regkey, current) {
                var re = new RegExp(regkey, 'g');
                // start with root's parent because we don't want to dump current critial_section
                current = current.parent;
                while ((current != null) && (current.parent != null)) {
                    // check to see if current is dumpable and if key matches regkey
                    if (current.dumpable && (current.key.match(re) != null)) {
                        // remove ancestor from parent chain; point at next in chain/null
                        current = this._deleteAncestor(current);
                    } else {
                        // move on to next iteration
                        current = current.parent;
                    }
                }
            },

            /**
             * remove an ancestor from the parent chain
             * @param {object} current eventContex to remove from parent chain
             * @return {object} next eventContext in chain after deleted one, or null if none
             */
            _deleteAncestor: function (current) {
                var parent = current.parent;
                var children = current.deps;
                // tell the children initially that they no longer have a parent
                for (var i = 0; i < children.length; ++i) {
                    children[i].parent = null;
                }
                // if there is a parent, setup each child
                if (parent != null) {
                    // remove current as child of parent
                    var ref = parent.deps.indexOf(current);
                    if (ref != -1) {
                        // delete this dep from parent
                        parent.deps.splice(ref, 1);
                    }
                    // add children to parent
                    for (var i = 0; i < children.length; ++i) {
                        this._parent(children[i], parent);
                    }
                }
                // test to see if we've seen the handler for this already
                if (current.handled) {
                    // remove ancestor from eventQueue all together;
                    this.eventQueue.resolve(current);
                } else {
                    // leave dumped event in queue to catch handler, but force expiry
                    if (current.expires == null) {
                        current.expires = this.getTime() + sfun.TIMEOUT_expireEVENT;
                    }
                }
                // update count
                this._dump_count++;
                // optional debugging
                if (sfun.api_getDebug() && true) {
                    var logstr = 'D dumped event[' + current.key + ']';
                    if (children.length > 0) {
                        logstr += ', reparented ' + children.length + ' child:0[' + children[0].key + ']';
                    }
                    if (parent != null) {
                        logstr += ' to parent[' + parent.key + ']';
                    } else {
                        logstr += ', no parent';
                    }
                    console.log(logstr);
                }
                // return parent, or null if there's none
                return parent;
            },

            /**
             * work up through the parents to find the oldest ancestor
             * @param {object} current
             * @return {object} earliest ancestor (end of parent chain)
             */
            _earliestAncestor: function (current) {
                while ((current != null) && (current.parent != null)) {
                    current = current.parent;
                }
                return current;
            },

            /**
             * @param {object} s1 event context
             * @param {object} s2 event context
             * @return {boolean} true if s1 is a parent of s2
             */
            _isParentOf: function (s1, s2) {
                while (s2.parent != null) {
                    if (s2.parent == s1) {
                        return true;
                    }
                    // make s2 its parent and test again
                    s2 = s2.parent;
                }
                return false;
            },

            /**
             * tell parent that one of its child objects has been resolved
             * @param {object} obj child that's been resolved
             * @param {object} parentContext context to update
             */
            _parentResolve: function (obj, parentContext) {
                // remove this from parent's outstanding deps
                var ref = parentContext.deps.indexOf(obj);
                if (ref != -1) {
                    // delete this dep from parent
                    parentContext.deps.splice(ref, 1);
                }
                // if we've resolved all the parent's deps
                if (parentContext.deps.length == 0) {
                    if (sfun.api_getDebug() && false) {
                        console.log('U processing next/parent context[' + this.renderToString(obj.parent) + '], following resolution of context[' + this.renderToString(obj) + ']');
                    }
                    // process parent
                    this._setCriticalSection(parentContext);
                    this._contextExecute(parentContext);
                }
                // flag as no longer parented
                obj.parent = null;
            },

            // PUBLIC FUNCTIONS

            /**
             * @param boolean show true to display (default), false to hide
             */
            'display': function (show) {
                if (show) {
                    // @todo could move to init function
                    // tell vis where it can find the event queue
                    this._vis.init(this);
                }
                this._vis.display(show);
            },

            /**
             * @return {string} render simple string of object
             */
            'renderToString': function (obj) {
                if (obj == null) {
                    return '<no event context>';
                }
                var output = obj.idx + ':' + obj.key + ', ' + obj.deferred.state();
                if (obj.comment) {
                    output += ', ' + obj.comment;
                }
                if (obj.deps.length) {
                    output += ', ' + obj.deps.length + ' deps';
                }
                return output;
            },

            /**
             * work through eventQueue looking for expired events
             */
            'checkExpiries': function () {
                if (sfun.api_getDebug()) {
                    console.log('checking expiries');
                }
                var obj, timenow = this.getTime();
                // note dynamic getSize() call, because list is changing during loop
                for (var i = 0; i < this.getSize(); ++i) {
                    obj = this.objarr[i];
                    if (obj.expires != null) {
                        if (timenow > obj.expires) {
                            if (sfun.api_getDebug()) {
                                console.log('expiring eventContext[' + obj.key + ']');
                            }
                            this.resolve(obj);
                            // beware: resolve deletes at most 1 elements from array, so redo
                            i--;
                        }
                    }
                }
            },

            /**
             * @return {int} time in milliseconds
             */
            'getTime': function () {
                var d = new Date;
                return d.getTime();
            },

            /**
             * push event object onto event queue
             * @param {object} partial fields to override defaults
             */
            'push': function (partial) {
                var that = this;
                // start by trying to match this key to an existing event in the queue
                var obj = null;
                if (typeof(partial.key) != 'undefined') {
                    obj = this.get(partial.key);
                }
                // if we've created the object, prep and push it
                if (obj == null) {
                    // compose new object ($.extend gives right to left precedence)
                    var obj = $.extend({},
                        // 1: static defaults
                        this._default_event_object, {
                            // 2: dynamic defaults
                            'key': this._default_event_object.key + this.getCounter() + '>',
                            // create new deferred, but ignore if already set in partial
                            'deferred': sfun.api_getDeferred(),
                            // set expiry
                            'expires': this.getTime() + sfun.TIMEOUT_expireEVENT,
                            'deps': []
                        },
                        // 3: overrides from call
                        partial
                    );
                    // push
                    var ref = this._push(obj);
                    // optional debugging message
                    if (sfun.api_getDebug() && false) {
                        console.log('+ pushed event context[' + this.renderToString(obj) + '], qlen now ' + (this.getSize()));
                    }
                }
                // but if we've found an existing object matching the key
                else {
                    // merge in any partial fields that we want to keep
                    if (obj.comment) {
                        obj.comment += ', now peered with sister [' + partial.comment + ']';
                    }
                    // optional debugging message
                    if (sfun.api_getDebug() && false) {
                        console.log('+ not-pushed, found sister event context[' + this.renderToString(obj) + '], qlen now ' + (this.getSize()));
                    }
                }
                // if the object expires, schedule its removal
                if (obj.expires) {
                    // clear old [eventQueue-wide] timeout
                    if (that._expiry_handler != null) {
                        clearTimeout(that._expiry_handler);
                    }
                    // schedule a [single shared eventQueue-wide] check after the timeout
                    this._expiry_handler = setTimeout(function () {
                        that.checkExpiries();
                    }, sfun.TIMEOUT_expireEVENT);
                }
                if (sfun.api_getDebug()) {
                    this._vis.refresh('push', obj.idx);
                }
                // return the object (retreived or pushed)
                return obj;
            },

            /**
             * push event object or merge if a peer is set
             *   this does create issues if we try to pull based on the old key
             * @param {object} partial fields to override defaults
             */
            'pushOrMerge': function (partial, peer) {
                if (typeof(peer) == 'undefined') {
                    // if no peer, push new context with partial values
                    return this.push($.extend({}, partial));
                }
                // capture old position
                var ref = this.find(peer.key);
                // capture old description for debugging
                var olddesc = '';
                if (sfun.api_getDebug()) {
                    olddesc = this.renderToString(peer);
                }
                // aggregate the comments to enable clearer historical tracking
                if (partial.comment) {
                    partial.comment += ', was ' + peer.comment;
                }
                // merge in set fields
                $.extend(peer, partial);
                // manually update old indices
                if (ref != -1) {
                    this.keyarr[ref] = peer.key
                }
                // optional debugging
                if (sfun.api_getDebug() && true) {
                    console.log('  - merged event context[' + this.renderToString(peer) + '] into old context[' + olddesc + '], unaffected q len now' + this.getSize());
                }
                if (sfun.api_getDebug()) {
                    this._vis.refresh('pushOrMerge', peer.idx);
                }
                return peer;
            },

            /**
             * push event object onto event queue and setup parenting
             * copes with 1:N parent:child relationships
             * @param {object} partial fields to override defaults
             * @param {object} parentContext
             */
            'pushOrParent': function (partial, parent) {
                if (typeof(parent) == 'undefined') {
                    // if no parent, just push the partial
                    return this.push(partial);
                }
                // aggregate the comments to enable clearer historical tracking
                if (partial.comment) {
                    partial.comment += ', inherited from ' + parent.comment + ' (which is now upstream)';
                }
                // push partial in normal way
                var obj = this.push(partial);
                // attach this obj as child to parent
                this._parent(obj, parent);
                if (sfun.api_getDebug()) {
                    this._vis.refresh('pushOrParent', obj.idx);
                }
                return obj;
            },

            /**
             * interface function to get from table
             * @param {string} key to search for
             * @param {bool} [alsoRemove] true to delete matched elements
             * @return {object} matched object or null if not found
             */
            'get': function (key) {
                var obj = this._get(key, false);
                if (obj != null) {
                    if (sfun.api_getDebug() && false) {
                        console.log('- pulled event context[' + this.renderToString(obj) + '], q' + this.getSize());
                    }
                } else {
                    if (sfun.api_getDebug() && false) {
                        console.log('o unfilled get request for key[' + key + ']');
                    }
                }
                return obj;
            },

            /**
             * @param {object} partial fields to override defaults
             * @return {object} created object if fresh or matched object if found
             */
            'getOrInvent': function (partial) {
                var retrieved = null;
                if (typeof(partial.key) != 'undefined') {
                    retrieved = this.get(partial.key);
                }
                // if this is a fresh event that we didn't fire
                if (retrieved == null) {
                    // create object using shallow copy of defaults, then overwrite set fields
                    retrieved = this.invent(partial);
                    // store, which will add to unhandled list
                    retrieved = this.push(retrieved);
                }
                // otherwise if we've fired (and not resolved) this event
                else {
                    // aggregate the comments to enable clearer historical tracking
                    if (retrieved.comment) {
                        retrieved.comment += ', instead of ' + partial.comment;
                    }
                    if (sfun.api_getDebug() && false) {
                        console.log('* handler caught fired event context[' + this.renderToString(retrieved) + '], q' + this.getSize());
                    }
                }
                return retrieved;
            },

            /**
             * invent an event context
             * @param {object} partial for context to invent
             * @return {object} created object
             */
            'invent': function (partial) {
                if (typeof(partial.key) == 'undefined') {
                    partial.key = '<unset>';
                }
                // create object using shallow copy of defaults, then overwrite set fields
                var retrieved = $.extend({}, this._default_event_object, {
                    'deferred': sfun.api_getDeferred(),
                    'deps': [],
                }, partial);
                return retrieved;
            },

            /**
             * process act-on-event decision
             * event contexts:
             *   get resolved when they've done their work (action function)
             *   get marked as handled whether they get queued or not
             * @param {object} eventContext
             * @param {function} func to call or store; this function contains its own wrapUp calls
             */
            'actOnContext': function (eventContext, func, func_context) {
                var that = this;
                // only act if we've been given a real eventContext that hasn't been handled or already begun processing
                if (eventContext == null || eventContext.handled == true || eventContext.action == null) {
                    // otherwise just return a nice resolved deferred
                    return sfun.api_getDeferred().resolve();
                }
                // store the function content for when we callback func
                eventContext.context = func_context;
                // flag that this context has now been through a handler
                eventContext.handled = true;
                // should we be nullifying this event
                if (eventContext.replaceEvent != null) {
                    // process by calling null function then wrap up, instead of processing this event directly
                    eventContext.action = function () {
                    };
                    // make sure replaceEvent function isn't used twice, if eventContext cascades to multiple events
                    eventContext.replaceEvent = null;
                    // optional debugging message
                    if (sfun.api_getDebug() && false) {
                        console.log('replaceEvent used in place for ' + this.renderToString(eventContext) + ', critical section left unchanged (' + this.renderToString(this._critical_section) + ')');
                    }
                    // call func with outer class context, then wrap up
                    this._contextExecute(eventContext);
                }
                // test to see if any other event is in its critical section
                else if (this._critical_section == null) {
                    // if not, flag event as in its critical section
                    this._setCriticalSection(eventContext);
                    // optional debugging message
                    if (sfun.api_getDebug() && false) {
                        console.log('> entering fresh critical section (from null) for ' + this.renderToString(eventContext));
                    }
                    // call func with outer class context, then wrap up
                    eventContext.action = func;
                    this._contextExecute(eventContext);
                }
                // test to see if we're actually still in the same context (eventContext == critical_section)
                else if (eventContext.key == this._critical_section.key) {
                    // we're reusing the same context, so just call and leave critical_section alone
                    eventContext.action = func;
                    this._contextExecute(eventContext);
                }
                // test to see if we're in the parent's context (parent eventContext == critical_section)
                else if (this._isParentOf(this._critical_section, eventContext)) {
                    // call and leave critical_section alone
                    eventContext.action = func;
                    this._contextExecute(eventContext);
                }
                else {
                    // delay func by queuing (parent on earliestAncestor), but clean chain
                    eventContext.action = func
                    this._contextDelayExecution(eventContext);
                }
                return eventContext.deferred;
            },

            /**
             * @param {object} object to resolve and remove if found
             * @param {mixed} returnValue optional value to return via resolve
             * @return {object} jQuery deferred
             */
            'resolve': function (obj, returnValue) {
                if (obj != null) {
                    // remove this object from the eventQueue
                    var ref = this.removeObj(obj);
                    if (sfun.api_getDebug() && false) {
                        console.log('Q resolve event context[' + this.renderToString(obj) + '], qlen now ' + this.getSize());
                    }
                    // resolve its deferred if set
                    if (obj.deferred != null) {
                        obj.deferred.resolve(returnValue);
                    }
                    // if object has a parent, update it
                    if (obj.parent != null) {
                        this._parentResolve(obj, obj.parent);
                    }
                    if (this.debug) {
                        this._vis.refresh('resolve', obj.idx);
                    }
                }
                // always return a resolved deferred
                return sfun.api_getDeferred().resolve(returnValue);
            },

            /**
             * @param {object} object to reject and remove if found
             * @param {mixed} returnValue optional value to return via reject
             * @return {object} jQuery deferred
             */
            'reject': function (obj, returnValue) {
                if (sfun.api_getDebug()) {
                    this._vis.refresh('reject', obj.idx);
                }
                if (obj != null) {
                    // remove this object from the eventQueue
                    var ref = this.removeObj(obj);
                    if (sfun.api_getDebug() && true) {
                        console.log('Q rejected event context[' + this.renderToString(obj) + '], qlen now ' + this.getSize());
                    }
                    // reject its deferred if set
                    if (obj.deferred != null) {
                        return obj.deferred.reject(returnValue);
                    }
                }
                // always return a rejected deferred
                return sfun.api_getDeferred().reject(returnValue);
            },

            // TEST SUITE support

            /**
             * @return {object} critical section
             */
            'tss_getCriticalSection': function () {
                return this._critical_section;
            },

            /**
             * @param obj
             * @param parentContext
             * @returns {object} obj (updated)
             */
            'tss_parent': function (obj, parentContext) {
                return this._parent(obj, parentContext);
            },

            lastEntry: null
        })

    });

}));
