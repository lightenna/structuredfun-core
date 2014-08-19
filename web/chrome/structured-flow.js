/**
 * StructuredFun javascript
 * flow: layout engine
 */
(function($, sfun, undefined) {

  // ---------
  // CONSTANTS
  // ---------

  var debug = true;
  var $document = $(document);

  // ---------
  // FUNCTIONS
  // ---------

  this.init = function() {
    var obj = {
      'context' : this,
      'key' : 'flow',
      'callback' : this.flow_register,
      'layoutResize' : this.flow_cellsResize,
    };
    // not sure of init order, so push async
    // sfun.push('registerLayout', obj);
  };

  // Layout API

  /**
   * called by sfun when ready
   */
  this.flow_register = function() {
  }

  /**
   * refresh the visible cell sizes by minor axis then major
   * @param {object} range {first_1, last_n, selected} range of sequence numbers to resize
   * @todo need to thoroughly analyse speed of this
   */
  this.flow_cellsResize = function(range) {
    var that = this;
    var deferred = $.Deferred();
    var defs = [];
    var direction = sfun.api_getDirection();
    var selectedMajorCoordabsInitial = 0;
    var jqSelected = sfun.api_getCell(range.selected);
    if (!jqSelected.length) {
      // if we can't find the selected image, just use the first
      jqSelected = sfun.api_getCell(range.first_1);
    }
    // record the initial absolute coord of the image
    selectedMajorCoordabsInitial = (direction == 'x' ? jqSelected.offset().left : jqSelected.offset().top);
    var wrapUp = function() {
      // now that all cells resized, realign using scrollbar instead of container position
      that._cellsResizeRealignMajor(jqSelected, selectedMajorCoordabsInitial, true);
      // resolve deferred
      deferred.resolve();
    }
    // fetch visible cells and group by major axis value
    var cellGroup = {};
    // iterate across visible and visnear cells
    for (var i = range.first_1 ; i <= range.last_n ; ++i) {
      var jqEnt = $('#seq-'+i);
      // only include resizeablecells in the bucket
      if (!jqEnt.hasClass('resizeablecell')) {
        continue;
      }
      // pull out the major axis coord (absolute and relative to viewport edge)
      var pos = jqEnt.offset();
      var coordabs = (direction == 'x' ? pos.left : pos.top);
      var coordrel = coordabs - (direction == 'x' ? $document.scrollLeft() : $document.scrollTop());
      // if we don't have a bucket for this absolute coord, create one
      if (!(cellGroup[coordabs] instanceof Array)) {
        cellGroup[coordabs] = [];
      }
      // add jqEnt into bucket
      cellGroup[coordabs][cellGroup[coordabs].length] = jqEnt;
    }
    // work through all visible buckets
    for (var bucket in cellGroup) {
      var defid = defs.length;
      defs[defid] = $.Deferred();
      if (debug && false) {
        console.log('cellsResize processing bucket['+bucket+'] of len['+cellGroup[bucket].length+'] defid['+defid+']');
      }
      // function closure to wrap value of bucket
      (function(bucket, def) {
        // get ratio and total
        var minorTotal = this._cellsResizeTotalMinor(cellGroup[bucket]);
        // resize minor axis
        var maxMajor = that._cellsResizeBucketMinor(cellGroup[bucket], minorTotal);
        // resize major axis
        that._cellsResizeBucketMajor(cellGroup[bucket], maxMajor);
        // realign selected against initial position
        that._cellsResizeRealignMajor(jqSelected, selectedMajorCoordabsInitial, false);
        def.resolve();
      })(bucket, defs[defid]);
    }
    $.when.apply($, defs).always(wrapUp);
    return deferred;
  }

  // Helper functions

  /**
   * calculate normalMinors their total
   * @param  {array} bucket collection of cells
   * @return {object} jQuery deferred with value of minorTotal
   */
  this._cellsResizeTotalMinor = function(bucket) {
    var normalMinor, minorTotal = 0;
    var direction = sfun.api_getDirection();
    for (var i = 0 ; i<bucket.length ; ++i) {
      var jqEnt = bucket[i];
      var jqBoundable = jqEnt.find('.boundable');
      if (debug && false) {
        console.log('cellResizeTotalMinor-'+jqEnt.data('seq')+' ratio['+jqBoundable.data('ratio')+']');
      }
      // calculate the normal minor based on ratio
      normalMinor = (direction == 'x' ? jqEnt.width() / jqBoundable.data('ratio') : jqEnt.height() * jqBoundable.data('ratio'));
      minorTotal += normalMinor;
    }
    return minorTotal;
  }

  /**
   * resize all the minor axes
   * @param  {array} bucket collection of cells
   * @param  {real} minorTotal sum of all the minor axes
   * @return {real} maxMajor
   */
  this._cellsResizeBucketMinor = function(bucket, minorTotal) {
    var direction = sfun.api_getDirection();
    var viewportMinor = (direction == 'x' ? sfun.api_getViewportHeight() : sfun.api_getViewportWidth());
    // change the cell minor according to proportion of total
    var proportionTotal = 0;
    var maxMajor = 0;
    for (var i = 0 ; i<bucket.length ; ++i) {
      var jqEnt = bucket[i];
      var jqBoundable = jqEnt.find('.boundable');
      // calculate the normal minor based on ratio
      var ratio = jqBoundable.data('ratio');
      var normalMinor = (direction == 'x' ? jqEnt.width() / ratio : jqEnt.height() * ratio);
      // calculate proportion as a percentage, round to 1 DP
      var proportion = sfun.api_round( normalMinor * 100 / minorTotal, 1);
      var absolute = sfun.api_round( normalMinor * viewportMinor / minorTotal, 1);
      // if this is the last cell in the bucket, fill to 100%
      if (i == bucket.length-1) {
        proportion = 100 - proportionTotal;
      } else {
        // otherwise tot up proportions so far
        proportionTotal += proportion;
      }
      // apply percentage to cell minor
      jqEnt.css((direction == 'x' ? 'height': 'width'), (false ? absolute+'px' : proportion +'%'));
      // update bound if necessary
      sfun.api_setBound(jqEnt);
      // calculate normal major, max
      var newMinor = proportion * viewportMinor / 100;
      maxMajor = Math.max(maxMajor, (direction == 'x' ? newMinor * ratio : newMinor / ratio));
      if (debug && false) {
        console.log('cellResizeBucketMinor-'+jqEnt.data('seq')+' minor['+normalMinor+'] major['+(direction == 'x' ? normalMinor * ratio : normalMinor / ratio)+']');
      }
    }
    return maxMajor;
  }

  /**
   * resize all the major axes
   * @param  {array} bucket collection of cells
   * @param  {real} maxMajor the largest major axis
   */
  this._cellsResizeBucketMajor = function(bucket, maxMajor) {
    var direction = sfun.api_getDirection();
    var viewportMajor = (direction == 'x' ? sfun.api_getViewportWidth() : sfun.api_getViewportHeight());
    // calculate the new percentage major, bound (0-100), round (1DP)
    var proportion = sfun.api_round(Math.max(0, Math.min(100, (maxMajor) * 100 / viewportMajor )),1);
    var absolute = sfun.api_round(maxMajor,1);
    // change all the majors
    for (var i = 0 ; i<bucket.length ; ++i) {
      var jqEnt = bucket[i];
      jqEnt.css((direction == 'x' ? 'width': 'height'), (false ? absolute+'px' : proportion +'%'));
      jqEnt.addClass('cell-specific');
      if (debug && false) {
        console.log('cellResizeBucketMajor-'+jqEnt.data('seq')+' major['+proportion+'%]');
      }
    }
    for (var i = 0 ; i<bucket.length ; ++i) {
      var jqEnt = bucket[i];
      // make all images y-bound, as it's a simpler alignment than
      var jqBoundable = jqEnt.find('.boundable');
      jqBoundable.removeClass('x-bound').addClass('y-bound');
      // also remove any 'pending resize' flags
      jqEnt.removeClass('resizepending');
    }
  }

  /**
   * realign a given cell with its initial position
   * @param  {object} jqSelected jQuery selected image
   * @param  {real} initial selected major absolute coord
   * @param  {boolean} useScroll true to align using scrollbar, false using container position
   */
  this._cellsResizeRealignMajor = function(jqSelected, initial, useScroll) {
    var direction = sfun.api_getDirection();
    var coordabs = (direction == 'x' ? jqSelected.offset().left : jqSelected.offset().top);
    var diff = sfun.api_round(initial - coordabs, 2);
    var csel = sfun.api_getLayoutRoot();
    var property = (direction == 'x' ? 'left' : 'top');
    // get the container's current csel offset (without 'px')
    var cselOffset = sfun.api_round(parseFloat(csel.css(property)), 2);
    if (useScroll) {
      var scrolldiff = cselOffset + diff;
      // stop using container
      csel.css(property, 0);
      // scroll instead
      var oldpos = { 'left': $document.scrollLeft(), 'top': $document.scrollTop() };
      // don't need to do using hashUpdate because we're keeping offseq where it is (probably 0)
      var newpos = { 'left': (direction == 'x' ? oldpos.left - scrolldiff : 0), 'top':(direction == 'x' ? 0 : oldpos.top - scrolldiff) };
      // if we're changing position, fire scroll
      if ((newpos.left != oldpos.left) || (newpos.top != oldpos.top)) {
        // note: async scroll will not expose new cells, only realign without container offset
        // @todo need to crop this new position against viewport
        sfun.api_triggerScroll(newpos, true);
      }
    } else {
      // add diff to current csel offset
      csel.css(property, cselOffset + diff);
    }
  }

  // call init function
  this.init();

})(jQuery, window.sfun, undefined);
