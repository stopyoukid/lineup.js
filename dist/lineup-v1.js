/*! lineup-v1 - v0.2.0 - 2016-12-20
* https://github.com/stopyoukid/lineup.js
* Copyright (c) 2016 ; Licensed BSD */
(function() {
  function LineUpLoader(jQuery, d3, _) {

/**
 * Constructor to Create a LineUp Visualization
 * @param spec - the specifications object
 * @param spec.storage - a LineUp Storage, see {@link LineUpLocalStorage}
 * @constructor
 */
var LineUp;
(function (LineUp, d3, $, undefined) {

  function LineUpClass(spec, $container, config) {
    var $defs, scroller;
    this.storage = spec.storage;
    this.spec = spec;
//    this.sortedColumn = [];
    this.$container = $container;
    this.tooltip = LineUp.createTooltip($container.node());

    // Hide default tooltip to avoid undesired artifacts.
    this.tooltip.hide();

    //trigger hover event
    this.listeners = d3.dispatch('hover','change-sortcriteria','change-filter', 'columns-changed', 'selected','multiselected', 'generate-histogram');

    this.config = $.extend(true, {}, LineUp.defaultConfig, config, {
      //TODO internal stuff, should to be extracted
      columnBundles: {
        primary: {
          sortedColumn: null,
          sortingOrderAsc: true,
          prevRowScale : null
        }
      }});
    this.storage.config = this.config;
    if (!this.config.svgLayout.addPlusSigns) {
      this.config.svgLayout.plusSigns={}; // empty plusSign if no plus signs needed
    }



    //create basic structure
    if (this.config.svgLayout.mode === 'combined') {
      //within a single svg with 'fixed' header
      $container.classed('lu-mode-combined', true);
      this.$table = $container.append('svg').attr('class', 'lu');
      $defs = this.$table.append('defs');
      $defs.append('defs').attr('class', 'columnheader');
      $defs.append('defs').attr('class', 'column');
      $defs.append('defs').attr('class', 'overlay');
      this.$body = this.$table.append('g').attr('class','body').attr('transform', 'translate(0,' + this.config.htmlLayout.headerHeight + ')');
      this.$header = this.$table.append('g').attr('class', 'header');
      this.$bodySVG = this.$headerContainer = this.$table;

      scroller = this.initScrolling($($container.node()), this.config.htmlLayout.headerHeight);
    } else {
      //within two svgs with a dedicated header
      $container.classed('lu-mode-separate', true);
      this.$table = $container;
      this.$headerContainer = this.$table.append('div').attr('class', 'lu lu-header');
      this.$headerContainer.style({ 'height': this.config.htmlLayout.headerHeight + "px", "width": "100%" });
      this.$header = this.$headerContainer.append('div');

      this.$bodySVG =
        this.$table.append('div')
          .attr('class','lu-wrapper')
            .append('div')
              .attr('class','lu lu-body')
              .attr('height', '100%')
              .attr('style', 'overflow-y:auto;height:100%');
      this.$spacer = this.$bodySVG.append('div');
      this.$body = this.$bodySVG;
      scroller = this.initScrolling($($container.node()).find('div.lu-wrapper'), 0);
    }
    this.selectVisible = scroller.selectVisible;
    this.onScroll = scroller.onScroll;

    this.$header.append('div').attr('class', 'header-background').style({
      width: "100%",
      height: this.config.htmlLayout.headerHeight + "px",
      "background-color": 'lightgray'
    }).text(" ");
    this.$header.append('div').attr('class', 'main').style({
      width: "100%",
      height: this.config.htmlLayout.headerHeight + "px"
    }).text(" ");
    this.$header.append('div').attr('class', 'overlay');

    this.headerUpdateRequired = true;
    this.stackedColumnModified = null;

    this.dragWeight = this.initDragging();

    return this;
  }


  LineUp.prototype = LineUpClass.prototype = $.extend(LineUpClass.prototype, LineUp.prototype);
  LineUp.create = function (storage, $container, options) {
    if (!('storage' in storage)) { // TODO: was '!$.isPlainObject(storage)'
      storage = { storage: storage };

    }
    var r = new LineUpClass(storage, $container, options);
    r.startVis();
    return r;
  };

  LineUp.prototype.scrolled = function (top, left) {
    if (this.config.svgLayout.mode === 'combined') {
      //in single svg mode propagate vertical shift
      this.$header.style({ transform: 'translate(0px,' + top + 'px)' });
      this.$header.selectAll('div.header-background').style({ transform: 'translate(0px,' + -top + 'px)' });
    } else {
      //in two svg mode propagate horizontal shift
      this.$header.style({ 'transform': 'translate('+-left+'px,0px)' });
      this.$header.selectAll('div.header-background').style({ transform: 'translate('+left+'px,0px)' });
    }
  };

  /**
   * default config of LineUp with all available options
   *
   */
  LineUp.defaultConfig = {
    colorMapping: d3.map(),
    columnColors: d3.scale.category20(),
    grayColor: '#999999',
    numberformat: d3.format('.3n'),
    cellFormatter: undefined,
    htmlLayout: {
      headerHeight: 50,
      headerOffset: 0,
      buttonTopPadding: 3,
      labelLeftPadding: 12,
      buttonRightPadding: 18,
      buttonWidth: 13,
      handleWidth: 4
    },
    renderingOptions: {
      stacked: false,
      values: false,
      animation: true,
      histograms: false
    },
    svgLayout: {
      /**
       * mode of this lineup instance, either combined = a single svg with header and body combined or separate ... separate header and body
       */
      mode: 'combined', //modes: combined vs separate
      rowHeight: 20,
      rowPadding : 2,
      columnPadding: 2,
      rowBarPadding: 0,
      /**
       * number of backup rows to keep to avoid updating on every small scroll thing
       */
      backupScrollRows: 10,
      animationDuration: 1000,
      addPlusSigns:false,
      plusSigns: {
        addStackedColumn: {
         title: 'Add stacked column',
         action: 'addNewEmptyStackedColumn',
         x: 0, y: 2,
         w: 21, h: 21 // LineUpGlobal.htmlLayout.headerHeight/2-4
         }
      },
      rowActions: [
        /*{
         name: 'explore',
         icon: '\uf067',
         action: function(row) {
         console.log(row);
         }
         }*/]
    },
    /* enables manipulation features, remove column, reorder,... */
    manipulative: true,
    interaction: {
      //enable the table tooltips
      tooltips: true,
      multiselect: function() { return false; },
      rangeselect: function() { return false; }
    },
    filter: {
      skip: 0,
      limit: Number.POSITIVE_INFINITY,
      filter: undefined
    }
  };

  LineUp.prototype.on = function(type, listener) {
    if (arguments.length < 2) {
      return this.listeners.on(type);
    }
    this.listeners.on(type, listener);
    return this;
  };

  LineUp.prototype.changeDataStorage = function (spec) {
//    d3.select('#lugui-table-header-svg').selectAll().remove();
    this.storage = spec.storage;
    this.storage.config = this.config;
    this.spec = spec;
    this.config.columnBundles.primary.sortedColumn = null;
    this.headerUpdateRequired = true;
    delete this.prevRowScale;
    this.startVis();
  };

       /**
     * change a rendering option
    * @param option
    * @param value
    */
  LineUp.prototype.changeInteractionOption = function (option, value) {
    var v = this.config.interaction[option];
    if (v === value) {
      return;
    }
    this.config.interaction[option] = value;
  };

  /**
   * change a rendering option
   * @param option
   * @param value
   */
  LineUp.prototype.changeRenderingOption = function (option, value) {
    var v = this.config.renderingOptions[option];
    if (v === value) {
      return;
    }
    this.config.renderingOptions[option] = value;
    if (option === 'histograms') {
      if (value) {
        this.storage.resortData({ filteredChanged: true});
      }
    }
    this.updateAll(true);
  };

  /**
   * the function to start the LineUp visualization
   */
  LineUp.prototype.startVis = function () {
    this.assignColors(this.storage.getRawColumns());
    this.headerUpdateRequired = true;
    //initial sort
    this.storage.resortData({});
    this.updateAll();
  };

  LineUp.prototype.assignColors = function (columns) {
    //Color schemes are in config (.columnColors / .grayColor)

    // clear map
    var config = this.config;
    config.colorMapping = d3.map();

    var colCounter = 0;

    columns.forEach(function (d) {
      if (d.color) {
        config.colorMapping.set(d.id, d.color);
      } else if ((d instanceof LineUp.LineUpStringColumn) || (d.id === 'rank')) {
        // gray columns are:
        config.colorMapping.set(d.id, config.grayColor);
      } else {
        config.colorMapping.set(d.id, config.columnColors(colCounter));
        colCounter++;
      }
    });
    //console.log(config.colorMapping);
  };

  LineUp.prototype.updateAll = function (stackTransition, bundle) {
    var that = this;
    function updateBundle(b) {
      var cols = that.storage.getColumnLayout(b);
      that.updateHeader(cols);
      that.updateBody(cols, that.storage.getData(b), stackTransition || false);
    }
    if (bundle) {
      updateBundle(bundle);
    } else {
      Object.keys(this.storage.bundles).forEach(updateBundle);
    }
  };

  /**
   * sort by a column given by name
   * @param column
   * @param asc
   * @returns {boolean}
   */
  LineUp.prototype.sortBy = function (column, asc) {
    column = column || this.storage.primaryKey;
    asc = asc || false;

    var d = this.storage.getColumnByName(column);
    if (!d) {
      return false;
    }
    var bundle = this.config.columnBundles[d.columnBundle];
    bundle.sortingOrderAsc = asc;
    bundle.sortedColumn = d;

    this.listeners['change-sortcriteria'](this, d, bundle.sortingOrderAsc);
    if (!this.config.sorting || !this.config.sorting.external) {
      this.storage.resortData({column: d, asc: bundle.sortingOrderAsc});
    }
    this.updateAll(false, d.columnBundle);
  };

  /**
   * toggles the stacked rendering of this table
   */
  LineUp.prototype.toggleStackedRendering = function () {
    this.config.renderingOptions.stacked = !this.config.renderingOptions.stacked;
    this.updateAll(true);
  };

  /**
   * toggles whether values are rendered all the time
   */
  LineUp.prototype.toggleValueRendering = function () {
    this.config.renderingOptions.values = !this.config.renderingOptions.values;
    this.updateAll(true);
  };

  /**
   * set the limits to simulate pagination, similar to SQL skip and limit
   * @param skip start number
   * @param limit number or rows
   */
  LineUp.prototype.setLimits = function (skip, limit) {
    this.config.filter.skip = skip;
    this.config.filter.limit = limit;
    //trigger resort to apply skip
    this.storage.resortData({});
    this.updateAll();
  };

  /**
   * change the weights of the selected column
   * @param column
   * @param weights
   * @returns {boolean}
   */
  LineUp.prototype.changeWeights = function (column, weights) {
    if (typeof column === 'string') {
      column = this.storage.getColumnByName(column);
    }
    column = column || this.config.columnBundles.primary.sortedColumn;
    var bundle = column.columnBundle;
    if (!(column instanceof LineUp.LayoutStackedColumn)) {
      return false;
    }
    column.updateWeights(weights);
    //trigger resort
    if (column === this.config.columnBundles[bundle].sortedColumn) {
      this.listeners['change-sortcriteria'](this, column, this.config.columnBundles[bundle]);

      if (!this.config.sorting || !this.config.sorting.external) {
        this.storage.resortData({ key: bundle });
      }
    }
    this.updateAll(false, bundle);
    return true;
  };

    /**
     * manually change/set the filter of a column
     * @param column
     * @param filter
     */
  LineUp.prototype.changeFilter = function (column, filter) {
    if (typeof column === 'string') {
      column = this.storage.getColumnByName(column);
    }
    column.filter = filter;
    this.listeners['change-filter'](this, column);

    if (!this.config.filtering || !this.config.filtering.external) {
      this.storage.resortData({filteredChanged: true});
    }
    this.updateBody();
  };

  /**
   * destroys the DOM elements created by this lineup instance, this should be the last call to this lineup instance
   */
  LineUp.prototype.destroy = function () {
    //remove tooltip
    this.tooltip.destroy();
    this.$container.selectAll('*').remove();
    if (this.config.svgLayout.mode === 'combined') {
      this.$container.off('scroll', this.onScroll);
    }
  };
}(LineUp || (LineUp = {}), d3, jQuery));

/*global d3, jQuery, _ */
var LineUp;
(function (LineUp, d3, $, _, undefined) {
  function fixCSS(id) {
    return  id.replace(/[\s!\'#$%&'\(\)\*\+,\.\/:;<=>\?\@\[\\\]\^`\{\|\}~]/g, '_'); //replace non css stuff to _
  }
  /**
   * The mother of all Columns
   * @param desc The descriptor object
   * @class
   */
  function LineUpColumn(desc) {
    this.column = desc.column;
    this.label = desc.label || desc.column;
    this.color = desc.color;
    this.id = fixCSS(desc.id || this.column);
    this.missingValue = desc.missingValue;
    this.layout = {};
    this.config = desc || {};
  }

  LineUp.LineUpColumn = LineUpColumn;

  LineUpColumn.prototype = $.extend({}, {}, {
    getValue: function (row) {
      var r = row[this.column];
      if (typeof r === "undefined") {
        return this.missingValue;
      }
      return r;
    },
    getRawValue: function (row) {
      var r = this.getValue(row);
      if (typeof r === 'undefined') {
        return '';
      }
      return r;
    }
  });


  function isWildCard(v) {
    return typeof v !== 'number' || isNaN(v);
  }
  /**
   * A {@link LineUpColumn} implementation for Numbers
   * @param desc The descriptor object
   * @constructor
   * @extends LineUpColumn
   */
  function LineUpNumberColumn(desc, _, data) {
    LineUpColumn.call(this, desc);

    this.domain = desc.domain || [NaN, NaN];
    this.range = desc.range || [0, 1];
    if (typeof this.missingValue === "undefined") {
      this.missingValue = NaN;
    }

    //infer the min max
    var that = this;
    if (isWildCard(this.domain[0]) || isWildCard(this.domain[1])) {
      var minmax = d3.extent(data, function(row) { return that.getValue(row); });
      if (isWildCard(this.domain[0])) {
        this.domain[0] = minmax[0];
      }
      if (isWildCard(this.domain[1])) {
        this.domain[1] = minmax[1];
      }
    }
  }

  LineUp.LineUpNumberColumn = LineUpNumberColumn;

  LineUpNumberColumn.prototype = $.extend({}, LineUpColumn.prototype, {
    getValue: function (row) {
      var r = LineUpColumn.prototype.getValue.call(this, row);
      if (r === null || typeof r === 'undefined' || r === '' || r.toString().trim().length === 0) {
        r = this.missingValue;
      }
      return +r;
    },
    getRawValue: function (row) {
      var r = LineUpColumn.prototype.getValue.call(this, row);
      if (isNaN(r)) {
        return '';
      }
      return r;
    }
  });

  /**
   *A {@link LineUpColumn} implementation for Strings
   * @param desc The description object
   * @constructor
   * @extends LineUpColumn
   */
  function LineUpStringColumn(desc) {
    LineUpColumn.call(this, desc);
  }

  LineUp.LineUpStringColumn = LineUpStringColumn;

  LineUpStringColumn.prototype = $.extend({}, LineUpColumn.prototype, {

  });

  /**
   *A {@link LineUpColumn} implementation for Strings
   * @param desc The description object
   * @constructor
   * @extends LineUpColumn
   */
  function LineUpCategoricalColumn(desc, _, data) {
    LineUpColumn.call(this, desc);
    this.categories = [];
    this.categoryColors = d3.scale.category10().range();
    var that = this;
    if (desc.categories) {
        desc.categories.forEach(function(cat,i) {
            if (typeof cat === 'string') {
                that.categories.push(cat);
            } else {
                that.categories.push(cat.name);
                that.categoryColors[i] = cat.color;
            }
        });
    }
    if (this.categories.length === 0) {
      this.categories = d3.set(data.map(function(row) { return that.getValue(row); })).values();
      this.categories.sort();
    }
  }

  LineUp.LineUpCategoricalColumn = LineUpCategoricalColumn;

  LineUpCategoricalColumn.prototype = $.extend({}, LineUpColumn.prototype, {

  });

  /**
   *  --- FROM HERE ON ONLY Layout Columns ---
   */

  function LayoutColumn(desc) {
    var that = this;
    this.columnWidth = desc.width || 100;
    this.id = _.uniqueId("Column_");
    this.filter = desc.filter;

    this.parent = desc.parent || null; // or null
    this.columnBundle = "primary";
    //define it here to have a dedicated this pointer
    this.sortBy = function (a, b) {
      a = that.getValue(a);
      b = that.getValue(b);
      return that.safeSortBy(a, b);
    };
  }

  LineUp.LayoutColumn = LayoutColumn;

  LayoutColumn.prototype = $.extend({}, {}, {
    setColumnWidth: function (newWidth, ignoreParent) {
      this.columnWidth = newWidth;
      if (!ignoreParent && this.parent) {
        this.parent.updateWidthFromChild({id: this.id, newWidth: newWidth});
      }
    },
    getColumnWidth: function () {
      return this.columnWidth;
    },
    prepare: function(/*data*/) {

    },
    safeSortBy: function (a, b) {
      var an = typeof a === 'number' && isNaN(a);
      var bn = typeof b === 'number' && isNaN(b);
      if (an && bn) {
        return 0;
      }
      if (an) {
        return 1;
      }
      if (bn) {
        return -1;
      }
      return d3.descending(a, b);
    },

    flattenMe: function (array) {
      array.push(this);
    },
    description: function () {
      var res = {};
      res.width = this.columnWidth;
      res.filter = this.filter;

      return res;
    },
    makeCopy: function () {
      return new LayoutColumn(this.description());
    },
    isFiltered: function () {
      if (this instanceof LayoutNumberColumn) {
        var oMapping = this.originalMapping();
        var oScale = this.scale;
        if (oMapping && oScale) {
          var oldDomain = oMapping.domain();
          var domain = oScale.domain();
          return !isNaN(domain[0]) && !isNaN(domain[1]) && (domain[0] !== oldDomain[0] || domain[1] !== oldDomain[1]);
        }
        return false;
      }
      return typeof this.filter !== 'undefined' && this.filter !== '' && this.filter !== null;
    },
    filterBy: function (/*row*/) {
      return true;
    }
  });

  function LayoutSingleColumn(desc, rawColumns) {
    LayoutColumn.call(this, desc);
    this.columnLink = desc.column;
    this.column = rawColumns.get(desc.column);
    this.id = fixCSS(_.uniqueId(this.columnLink + "_"));
  }

  LineUp.LayoutSingleColumn = LayoutSingleColumn;

  LayoutSingleColumn.prototype = $.extend({}, LayoutColumn.prototype, {
    getValue: function (row, mode) {
      if (mode === 'raw') {
        return this.column.getRawValue(row);
      }
      return this.column.getValue(row);
    },

    getLabel: function () {
      return this.column.label;
    },
    getDataID: function () {
      return this.column.id;
    },

    description: function () {
      var res = LayoutColumn.prototype.description.call(this);
      res.column = this.columnLink;
      return res;
    },
    makeCopy: function () {
      var description = this.description();
      var lookup = d3.map();
      lookup.set(this.columnLink, this.column);
      var res = new LayoutSingleColumn(description, lookup);
      return res;
    }

  });

  function LayoutNumberColumn(desc, rawColumns) {
    LayoutSingleColumn.call(this, desc, rawColumns);

    //from normalized value to width value
    this.value2pixel = d3.scale.linear().domain([0, 1]).range([0, this.columnWidth]);
    var d = desc.domain || this.column.domain;
    if (isWildCard(d[0])) {
      d[0] = this.column.domain[0];
    }
    if (isWildCard(d[1])) {
      d[1] = this.column.domain[1];
    }
    this.scale = d3.scale.linear().clamp(true).domain(d).range(desc.range || this.column.range);
    this.histgenerator = d3.layout.histogram();
    var that = this;
    this.histgenerator.range(this.scale.range());
    this.histgenerator.value(function (row) { return that.getValue(row) ;});
    this._hist = [];
  }
  LineUp.LayoutNumberColumn = LayoutNumberColumn;

  LayoutNumberColumn.prototype = $.extend({}, LayoutSingleColumn.prototype, {
    mapping : function(newscale) {
      if (arguments.length < 1) {
        return this.scale;
      }
      this.scale = newscale.clamp(true);
      this.histgenerator.range(newscale.range());
    },
    originalMapping: function() {
      return  d3.scale.linear().clamp(true).domain(this.column.domain).range(this.column.range);
    },
    getHist: function(callback) {
      var that = this;
      if (this.histogramGetter) {
        this.histogramGetter(this, function(hist) {
          callback.call(that, hist);
        });
      } else {
        setTimeout(function() {
          callback.call(that, that._hist);
        }, 0);
      }
    },
    prepare: function(data, showHistograms, histogramGetter) {
      this.histogramGetter = histogramGetter;
      if (!showHistograms || histogramGetter) {
        this._hist = [];
        return;
      }
      //remove all the direct values to save space
      this._hist = this.histgenerator(data).map(function (bin) {
        return {
          x : bin.x,
          dx : bin.dx,
          y: bin.y
        };
      });
      var max = d3.max(this._hist, function(d) { return d.y; });
      this._hist.forEach(function (d) {
        if (max > 0) {
          d.y /= max;
        } else {
          d.y = 0;
        }
      });
    },
    binOf : function (row, callback) {
      var that = this;
      this.getHist(function (hist) {
        var v = that.getValue(row), i;
        if (hist) {
          for(i = hist.length -1 ; i>= 0; --i) {
            var bin = hist[i];
            if (bin.x <= v && v <= (bin.x+bin.dx)) {
              callback.call(that, i);
              return;
            }
          }
        }
        callback.call(that, -1);
      });
    },
    setColumnWidth: function (newWidth, ignoreParent) {
      this.value2pixel.range([0, newWidth]);
      LayoutSingleColumn.prototype.setColumnWidth.call(this, newWidth, ignoreParent);
    },
    getValue: function (row, mode) {
      if (mode === 'raw') {
        return this.column.getRawValue(row);
      }
      return this.scale(this.column.getValue(row));
    },
    getWidth: function (row) {
      var r = this.getValue(row);
      if (isNaN(r) || typeof r === 'undefined') {
        return 0;
      }

      // If there is no domain on the data, then just return a "full" bar, so it looks like there is some data
      var d = this.scale.domain();
      if (d[0] === d[1]) {
          return this.value2pixel.range()[1];
      }
      return this.value2pixel(r);
    },
    filterBy : function (row) {
      var filter = this.filter;
      if (typeof filter === 'undefined' || !this.column) {
        return true;
      }
      var r = this.getValue(row, 'raw');
      if (typeof filter === 'number' && isNaN(filter)) {
        return !isNaN(r);
      } else if (typeof filter === 'number') {
        return r >= filter;
      } else if (Array.isArray(filter)) {
        return filter[0] <= r && r <= filter[1];
      }
      return true;
    },

    description: function () {
      var res = LayoutColumn.prototype.description.call(this);
      res.column = this.columnLink;
      res.type = 'number';
      var a = this.scale.domain();
      var b = this.column.domain;
      if (a[0] !== b[0] || a[1] !== b[1]) {
        res.domain = a;
      }
      a = this.scale.range();
      b = this.column.range;
      if (a[0] !== b[0] || a[1] !== b[1]) {
        res.range = a;
      }
      return res;
    },
    makeCopy: function () {
      var lookup = d3.map();
      lookup.set(this.columnLink, this.column);
      var res = new LayoutNumberColumn(this.description(), lookup);
      return res;
    }
  });
  function LayoutStringColumn(desc, rawColumns) {
    LayoutSingleColumn.call(this, desc, rawColumns);
  }
  LineUp.LayoutStringColumn = LayoutStringColumn;

  LayoutStringColumn.prototype = $.extend({}, LayoutSingleColumn.prototype, {
    filterBy : function (row) {
      var filter = this.filter;
      if (typeof filter === 'undefined' || !this.column) {
        return true;
      }
      var r = this.getValue(row);
      if (typeof r === 'boolean') {
        return r && r.trim().length > 0;
      } else if (typeof filter === 'string' && filter.length > 0) {
        return (r && r + "").toLowerCase().indexOf(filter.toLowerCase()) >= 0;
      } else if (filter instanceof RegExp) {
        return (r && r + "").match(filter);
      }
      return true;
    },
    makeCopy: function () {
      var lookup = d3.map();
      lookup.set(this.columnLink, this.column);
      var res = new LayoutStringColumn(this.description(), lookup);
      return res;
    }
  });
  function LayoutCategoricalColumn(desc, rawColumns) {
    LayoutSingleColumn.call(this, desc, rawColumns);
  }
  LineUp.LayoutCategoricalColumn = LayoutCategoricalColumn;

  LayoutCategoricalColumn.prototype = $.extend({}, LayoutSingleColumn.prototype, {
    filterBy : function (row) {
      var filter = this.filter;
      if (typeof filter === 'undefined' || !this.column) {
        return true;
      }
      var r = this.getValue(row);
      if (Array.isArray(filter) && filter.length > 0) {
        return filter.indexOf(r) >= 0;
      } else if (typeof filter === 'string' && filter.length > 0) {
        return r && r.toLowerCase().indexOf(filter.toLowerCase()) >= 0;
      } else if (filter instanceof RegExp) {
        return r && r.match(filter);
      }
      return true;
    },
    makeCopy: function () {
      var lookup = d3.map();
      lookup.set(this.columnLink, this.column);
      var res = new LayoutCategoricalColumn(this.description(), lookup);
      return res;
    }
  });
    function LayoutCategoricalColorColumn(desc, rawColumns) {
        LayoutSingleColumn.call(this, desc, rawColumns);
    }
    LineUp.LayoutCategoricalColorColumn = LayoutCategoricalColorColumn;

    LayoutCategoricalColorColumn.prototype = $.extend({}, LayoutSingleColumn.prototype, {
        getColor: function(row) {
            var cat = this.getValue(row, 'raw');
            if (cat === null || cat === '') {
                return null;
            }
            var index = this.column.categories.indexOf(cat);
            if (index < 0) {
                return null;
            }
            return this.column.categoryColors[index];
        },
        filterBy : function (row) {
            return LayoutCategoricalColumn.prototype.filterBy.call(this, row);
        },
        makeCopy: function () {
            var lookup = d3.map();
            lookup.set(this.columnLink, this.column);
            var res = new LayoutCategoricalColorColumn(this.description(), lookup);
            return res;
        }
    });

  function LayoutRankColumn(desc, _dummy, _dummy2, storage) {
    LayoutColumn.call(this, desc ? desc : {}, []);
    this.columnWidth = desc ? (desc.width || 50) : 50;
    this.id = fixCSS(_.uniqueId('rank_'));
    //maps keys to ranks
    this.values = d3.map();
    this.storage = storage;
  }

  LineUp.LayoutRankColumn = LayoutRankColumn;


  LayoutRankColumn.prototype = $.extend({}, LayoutColumn.prototype, {
    setValue: function (row, d) {
      this.values.set(row[this.storage.primaryKey], d);
    },
    getValue: function (row) {
      return this.values.get(row[this.storage.primaryKey]);
    },
    filter: function (row) {
      var r = this.getValue(row);
      if (typeof r === 'undefined') {
        return true;
      } else if (typeof this.filter === 'number') {
        return r >= this.filter;
      } else if (Array.isArray(this.filter)) {
        return this.filter[0] <= r && r <= this.filter[1];
      }
      return true;
    },
    getLabel: function () {
      return 'Rank';
    },
    getDataID: function () {
      return this.id;
    },
    description: function () {
      var res = LayoutColumn.prototype.description.call(this);
      res.type = 'rank';
      return res;
    },
    makeCopy: function () {
      var description = this.description();
      var res = new LayoutRankColumn(description, null, null, this.column.storage);
      return res;
    }

  });


// TODO: maybe remove??
  function LayoutCompositeColumn(desc, rawColumns) {
    LayoutColumn.call(this, desc, rawColumns);
    this.childrenLinks = desc.children || [];
    this.label = desc.label || this.id;
  }

  LineUp.LayoutCompositeColumn = LayoutCompositeColumn;

  LayoutCompositeColumn.prototype = $.extend({}, LayoutColumn.prototype, {
    getDataID: function () {
      return this.id;
    },
    getLabel: function () {
      return this.label;
    }
  });


  function LayoutStackedColumn(desc, rawColumns, toLayoutColumn) {
    LayoutCompositeColumn.call(this, desc, rawColumns);
    this.childrenWeights = [];
    this.childrenWidths = [];
    this.toLayoutColumn = toLayoutColumn;
    this.children = [];
    this.emptyColumns = [];
    this.scale = d3.scale.linear().domain([0,1]).range([0, this.columnWidth]);
    this.init(desc);
    var that = this;
    this.sortBy = function (a, b) {
      var aAll = 0;
      var bAll = 0;
      that.children.forEach(function (d) {
        aAll += d.getWidth(a);
        bAll += d.getWidth(b);
      });
      return that.safeSortBy(aAll, bAll);
    };
  }

  LineUp.LayoutStackedColumn = LayoutStackedColumn;

  LayoutStackedColumn.prototype = $.extend({}, LayoutCompositeColumn.prototype, {

    getValue: function (row) {
      // TODO: a caching strategy might work here
      var that = this;
      var all = 0;
      this.children.forEach(function (d, i) {
        var r = d.getValue(row);
        if (isNaN(r) || typeof r === 'undefined') {
          r = 0;
        }
        all += r * that.childrenWeights[i];
      });
      return all;
    },
    init: function (desc) {
      var that = this;
      if (this.childrenLinks.length < 1) {
        this.emptyColumns.push(new LayoutEmptyColumn({parent: that}));
      } else {
        // check if weights or width are given
        if (this.childrenLinks[0].hasOwnProperty("weight")) {
          this.childrenWeights = this.childrenLinks.map(function (d) {
            return +(d.weight || 1);
          });

          this.scale.domain([0, d3.sum(this.childrenWeights)]);

          if (desc.hasOwnProperty('width')) {
            // if the stacked column has a width -- normalize to width
            this.childrenWidths = this.childrenWeights.map(function (d) {
              return that.scale(d);
            });
          } else {
            // if width was artificial set, approximate a total width of x*100
            this.columnWidth = this.children.length * 100;
            this.scale.range([0, that.columnWidth]);
          }
        } else {
          // accumulate weights and map 100px to  weight 1.0
          this.childrenWidths = this.childrenLinks.map(function (d) {
            return +(d.width || 100);
          });
          this.childrenWeights = this.childrenWidths.map(function (d) {
            return d / 100.0;
          });
          this.columnWidth = d3.sum(this.childrenWidths);
          this.scale.domain([0, d3.sum(this.childrenWeights)]).range([0, this.columnWidth]);
        }
        this.children = this.childrenLinks.map(function (d, i) {
          d.width = that.childrenWidths[i];
          d.parent = that;
          return that.toLayoutColumn(d);
        });
      }
    },
    flattenMe: function (array, spec) {
      var addEmptyColumns = false;
      if (spec) {
        addEmptyColumns = spec.addEmptyColumns || false;
      }
      array.push(this);
      this.children.forEach(function (d) {
        d.flattenMe(array);
      });

      if (addEmptyColumns) {
        this.emptyColumns.forEach(function (d) {
          return d.flattenMe(array);
        });
      }
    },
    filterBy: function (row) {
      if (typeof this.filter === 'undefined') {
        return true;
      }
      var val = this.getValue(row);
      if (typeof this.filter === 'number') {
        return val <= this.filter;
      } else if (Array.isArray(this.filter)) {
        return this.filter[0] <= val && val <= this.filter[1];
      }
      return true;
    },
    updateWidthFromChild: function () {
      var that = this;

      // adopt weight and global size
      this.childrenWidths = this.children.map(function (d) {
        return d.getColumnWidth();
      });
      this.childrenWeights = this.childrenWidths.map(function (d) {
        return that.scale.invert(d);
      });

      this.columnWidth = d3.sum(this.childrenWidths);
      this.scale.range([0, this.columnWidth]);
      this.scale.domain([0, d3.sum(this.childrenWeights)]);
    },
    setColumnWidth: function (newWidth) {
      var that = this;
      this.columnWidth = newWidth;
      that.scale.range([0, this.columnWidth]);
      this.childrenWidths = this.childrenWeights.map(function (d) {
        return that.scale(d);
      });
//        console.log(this.childrenWidths, this.childrenWeights);
      this.children.forEach(function (d, i) {
        return d.setColumnWidth(that.childrenWidths[i], true);
      });
    },
    updateWeights: function (weights) {
      this.childrenWeights = weights;
      this.scale.domain([0, d3.sum(this.childrenWeights)]);

      var that = this;
      this.childrenWidths = this.childrenWeights.map(function (d) {
        return that.scale(d);
      });
      this.columnWidth = d3.sum(this.childrenWidths);
      this.children.forEach(function (d, i) {
        return d.setColumnWidth(that.childrenWidths[i], true);
      });

      //console.log(this.childrenWeights);
      //console.log(this.childrenWidths);
    },
    removeChild: function (child) {
      var indexOfChild = this.children.indexOf(child);
      var that = this;
      this.childrenWeights.splice(indexOfChild, 1);
      this.childrenWidths.splice(indexOfChild, 1);

      this.columnWidth = d3.sum(this.childrenWidths);
      this.scale.range([0, this.columnWidth]);
      this.scale.domain([0, d3.sum(this.childrenWeights)]);


      this.children.splice(indexOfChild, 1);
      child.parent = null;
      if (this.children.length < 1) {
        this.emptyColumns = [new LineUp.LayoutEmptyColumn({parent: that})];
        this.columnWidth = 100;
      }

    },
    addChild: function (child, targetChild, position) {
      if (!(child instanceof LineUp.LayoutNumberColumn)) {
        return false;
      }

      var targetIndex = 0;
      if (targetChild instanceof LineUp.LayoutEmptyColumn) {
        this.emptyColumns = [];
      } else {
        targetIndex = this.children.indexOf(targetChild);
        if (position === 'r') {
          targetIndex++;
        }
      }

      this.childrenWeights.splice(targetIndex, 0, this.scale.invert(child.getColumnWidth()));
      this.childrenWidths.splice(targetIndex, 0, child.getColumnWidth());

      this.columnWidth = d3.sum(this.childrenWidths);
      this.scale.range([0, this.columnWidth]);
      this.scale.domain([0, d3.sum(this.childrenWeights)]);

      child.parent = this;
      this.children.splice(targetIndex, 0, child);

//        console.log('added Child:',this.children[targetIndex]);

      return true;

    },
    description: function () {
      var res = LayoutColumn.prototype.description.call(this);
      res.type = 'stacked';
      var that = this;
      res.children = this.children.map(function (d, i) {
        var r = d.description();
        r.weight = that.childrenWeights[i];
        return r;
      });
      res.label = this.label;
      return res;
    },
    makeCopy: function () {
      var that = this;
      var description = that.description();
      description.childrenLinks = [];
      var res = new LayoutStackedColumn(description, {}, that.toLayoutColumn);

      res.children = that.children.map(function (d) {
        return d.makeCopy();
      });
      res.children.forEach(function (d) {
        d.parent = res;
      });
      res.childrenWeights = this.childrenWeights.slice(0);
      res.scale.domain([0, d3.sum(this.childrenWeights)]);
      res.childrenWidths = this.childrenWeights.map(function (d) {
        return that.scale(d);
      });

      return res;
    }
  });


  function LayoutEmptyColumn(spec) {
    LayoutColumn.call(this, spec, []);
    this.id = _.uniqueId('empty_');
    this.label = '{empty}';
    this.columnWidth = 50;
  }

  LineUp.LayoutEmptyColumn = LayoutEmptyColumn;

  LayoutEmptyColumn.prototype = $.extend({}, LayoutColumn.prototype, {
    getLabel: function () {
      return this.label;
    },
    getDataID: function () {
      return this.id;
    },
    getValue : function() {
      return '';
    }
  });


  function LayoutActionColumn(spec) {
    spec = spec || {};
    LayoutColumn.call(this, spec, []);
    this.id = _.uniqueId('action_');
    this.label = '';
    this.columnWidth = spec.width || 50;
  }

  LineUp.LayoutActionColumn = LayoutActionColumn;

  LayoutActionColumn.prototype = $.extend({}, LayoutColumn.prototype, {
    getLabel: function () {
      return this.label;
    },
    getDataID: function () {
      return this.id;
    },
    description: function () {
      var res = LayoutColumn.prototype.description.call(this);
      res.type = 'actions';
      return res;
    },
    getValue : function() {
      return '';
    }
  });
}(LineUp || (LineUp = {}), d3, jQuery, _));
/* global d3, jQuery, window */
var LineUp;
(function (LineUp, d3, $, undefined) {
  LineUp.prototype = LineUp.prototype || {};
  /**
   * creates a simple popup window with a table
   * @param title
   * @param label optional if an input field is
   * @param options optional options like the dimension of the popup
   * @returns {{popup: *, table: *, remove: remove, onOK: onOK}}
   */
  function createPopup(container, title, label, options) {
    var popupWidth = 400;
    options = $.extend({}, options, {
      x: +(container.node().clientWidth) / 2 - (popupWidth / 2),
      //   y: 100,
      y: 0,
      width: popupWidth/*,
      height: 200*/
    });
    var popupBG = container.append('div')
        // var popupBG = d3.select("body").append("div")
      .attr("class", "lu-popupBG");

    var popup = container.append('div')
      .attr({
        "class": "lu-popup"
      }).style({
        left: options.x + "px",
        top: options.y + "px",
        width: options.width + "px"/*,
        height: options.height + "px"*/
      })
      .html(
        '<span style="font-weight: bold">' + title + '</span>' +
        (label ? '<input type="text" id="popupInputText" size="35" value="' + label + '"><br>' : '') +
        '<div class="selectionTable"></div>' +
        '<button class="cancel"><i class="fa fa-times"></i> cancel</button>' +
        '<button class="ok"><i class="fa fa-check"></i> ok</button>'
    );

    var theTable = popup.select(".selectionTable")/*.style({
      width: (options.width - 10) + "px",
      height: (options.height - 40) + "px"
    })*/.append("table");

    popup.select(".cancel").on("click", function () {
      popupBG.remove();
      popup.remove();
    });

    return {
      popup: popup,
      table: theTable,
      remove: function () {
        popup.remove();
        popupBG.remove();
      },
      onOK: function (handler) {
        return popup.select(".ok").on("click", handler);
      }
    };
  }

  LineUp.prototype.addNewStackedColumnDialog = function () {
    var that = this;

    var popup = createPopup(this.$container, 'Add stacked column:', 'Stacked');
    // list all data rows !
    var trData = that.storage.getRawColumns().filter(function (d) {
      return (d instanceof LineUp.LineUpNumberColumn);
    }).map(function (d) {
      return {d: d, isChecked: false, weight: 1.0};
    });

    var trs = popup.table.selectAll("tr").data(trData);
    trs.enter().append("tr");
    trs.append("td").attr("class", "checkmark");
    trs.append("td").attr("class", "datalabel").style("opacity", 0.8).text(function (d) {
      return d.d.label;
    });
    trs.append("td").append("input").attr({
      class: "weightInput",
      type: "text",
      value: function (d) {
        return d.weight;
      },
      'disabled': true,
      size: 5,
      maxlength: 5
    }).on("input", function (d) {
      d.weight = +this.value;
      redraw();
    });

    function redraw() {
      var trs = popup.table.selectAll("tr").data(trData);
      trs.select(".checkmark").html(function (d) {
        return (d.isChecked) ? '<i class="fa fa-check-square-o"></i>' : '<i class="fa fa-square-o"></i>';
      })
        .on("click", function (d) {
          d.isChecked = !d.isChecked;
          redraw();
        });
      trs.select(".datalabel").style("opacity", function (d) {
        return d.isChecked ? "1.0" : ".8";
      });
      trs.select(".weightInput").attr('disabled', function (d) {
        return d.isChecked ? null : true;
      });
    }

    redraw();

    function getElementById(id) {
      return $(that.$container.node()).find("#" + id)[0];
    }

    popup.onOK(function () {
      var name = getElementById("popupInputText").value;
      if (name.length < 1) {
        window.alert("name must not be empty");
        return;
      }
      //console.log(name, trData);

      var allChecked = trData.filter(function (d) {
        return d.isChecked;
      });

      //console.log(allChecked);
      var desc = {
        label: name,
        width: (Math.max(allChecked.length * 100, 100)),
        children: allChecked.map(function (d) {
          return {column: d.d.column, type: 'number', weight: d.weight};
        })
      };

      that.storage.addStackedColumn(desc);
      popup.remove();
      that.headerUpdateRequired = true;
      that.listeners['columns-changed'](that);
      that.updateAll();
    });

  };

  LineUp.prototype.addNewSingleColumnDialog = function () {
    var that = this;
    var popup = createPopup(this.$container, 'add single columns', undefined);
    // list all data rows !
    var trData = that.storage.getRawColumns()
//        .filter(function(d){return (d instanceof LineUpNumberColumn);})
      .map(function (d) {
        return {d: d, isChecked: false, weight: 1.0};
      });

    var trs = popup.table.selectAll("tr").data(trData);
    trs.enter().append("tr");
    trs.append("td").attr("class", "checkmark");
    trs.append("td").attr("class", "datalabel").style("opacity", 0.8).text(function (d) {
      return d.d.label;
    });


    function redraw() {
      var trs = popup.table.selectAll("tr").data(trData);
      trs.select(".checkmark").html(function (d) {
        return '<i class="fa fa-' + ((d.isChecked) ? 'check-' : '') + 'square-o"></i>';
      })
        .on("click", function (d) {
          d.isChecked = !d.isChecked;
          redraw();
        });
      trs.select(".datalabel").style("opacity", function (d) {
        return d.isChecked ? "1.0" : ".8";
      });
    }

    redraw();


    popup.onOK(function () {
      var allChecked = trData.filter(function (d) {
        return d.isChecked;
      });

//        console.log(allChecked);
//        var desc = {
//            label:name,
//            width:(Math.max(allChecked.length*100,100)),
//            children:allChecked.map(function(d){return {column: d.d.id, weight: d.weight};})
//        }

      allChecked.forEach(function (d) {
        that.storage.addSingleColumn({column: d.d.column});
      });

      popup.remove();

      if (allChecked.length) {
        that.listeners['columns-changed'](that);
      }

      that.headerUpdateRequired = true;
      that.updateAll();
    });
  };

  LineUp.prototype.reweightStackedColumnWidget = function (data, $table) {
    var toWeight = function (d) {
      return d.weight;
    };
    var predictScale = d3.scale.linear().domain([0, d3.max(data, toWeight)]).range([0, 120]);
    var trs = $table.selectAll("tr").data(data);
    var config = this.config;

    trs.enter().append("tr");
//    trs.append("td").attr("class", "checkmark")
    trs.append("td")
      .style({
        width: "20px"
      })
      .append("input").attr({
        class: "weightInput",
        type: "text",
        value: function (d) {
          return d.weight;
        },
        size: 5,
        maxlength: 5
      }).on("input", function (d) {
        data[d.index].weight = +this.value;
        redraw();
      });

    trs.append("td").append("div").attr("class", "predictBar").style({
      width: function (d) {
        return predictScale(d.weight) + "px";
      },
      height: 20 + "px",
      "background-color": function (d) {
        return config.colorMapping.get(d.dataID);
      }
    });

    trs.append("td").attr("class", "datalabel").text(function (d) {
      return d.d;
    });

    function redraw() {
      var trs = $table.selectAll("tr").data(data);
      predictScale.domain([0, d3.max(data, toWeight)]);
      trs.select(".predictBar").transition().style({
        width: function (d) {
          return predictScale(d.weight) + "px";
        }
      });
    }

    redraw();
  };

  LineUp.prototype.reweightStackedColumnDialog = function (col) {
    var that = this;
    var popup = createPopup(this.$container, 're-weight column "' + col.label + '"', undefined);

    //console.log(col.childrenWeights);
    // list all data rows !
    var trData = col.children
      .map(function (d, i) {
        return {
          d: d.column.label,
          dataID: d.getDataID(),
          weight: +col.childrenWeights[i],
          index: i
        };
      });

    this.reweightStackedColumnWidget(trData, popup.table);

    popup.onOK(function () {
      popup.remove();
      that.changeWeights(col, trData.map(function (d) {
        return d.weight;
      }));
    });
  };

  LineUp.prototype.openMappingEditor = function (selectedColumn, $button) {
    var bak = selectedColumn.mapping(),
      original = selectedColumn.originalMapping();
    var that = this;
    var act = bak;

    var containerHeight = this.$container.node().clientHeight;
    var height = Math.max(270, Math.min(containerHeight / 2, 470));
    var popupBG = this.$container.append('div')
        // var popupBG = d3.select("body").append("div")
        .attr("class", "lu-popupBG");

    var popup = this.$container.append('div')
      .attr({
        "class": "lu-popup"
      }).style({
        left: +(this.$container.node().clientWidth) / 2 - 100 + "px",
        //   top: 100 + "px",
        top: "0px",
        width: (height - 50) + "px",
        // height: height + "px"
      })
      .html(
        '<div style="font-weight: bold"> change mapping: </div>' +
        '<div class="mappingArea"></div>' +
        '<label><input type="checkbox" id="filterIt" value="filterIt">Filter Outliers</label><br>'+
        '<button class="cancel"><i class="fa fa-times"></i> cancel</button>' +
        '<button class="reset"><i class="fa fa-undo"></i> revert</button>' +
        '<button class="ok"><i class="fa fa-check"></i> ok</button>'
    );
    var $filterIt = popup.select('input').on('change', function() {
      applyMapping(act);
    });
    $filterIt.node().checked = Array.isArray(selectedColumn.filter);
    var access = function (row) {
      return +selectedColumn.getValue(row, 'raw');
    };

    function applyMapping(newscale) {
      act = newscale;
      selectedColumn.mapping(act);
      var val = $filterIt.node().checked;
      if (val) {
        selectedColumn.filter = newscale.domain();
      } else {
        selectedColumn.filter = undefined;
      }
      //console.log(act.domain().toString(), act.range().toString());
      $button.classed('filtered', !isSamePairs(act.range(), original.range()) || !isSamePairs(act.domain(), original.domain()));
      that.listeners['change-filter'](that, selectedColumn);
      if (!that.config.filtering || !that.config.filtering.external) {
        that.storage.resortData({filteredChanged: true});
      }
      that.updateAll(true);
    }

    var editorOptions = {
      callback: applyMapping,
      triggerCallback : 'dragend',
      width: height - 50,
      height: height - 50
    };
    var domain = original.domain();
    if (isNaN(domain[0])) {
      domain[0] = 0;
    }
    if (isNaN(domain[1])) {
      domain[1] = 0;
    }
    var editor = LineUp.mappingEditor(bak, domain, that.storage.rawdata, access, editorOptions, this);
    popup.select('.mappingArea').call(editor);

    function isSamePairs(a, b) {
      // return $(a).not(b).length === 0 && $(b).not(a).length === 0;
        if (a && b) {
          var firstEqual = a[0] === b[0];
          var secondEqual = a[1] === b[1];

          // If they are both NaN, then they are equal
          if (!firstEqual && isNaN(a[0]) && isNaN(b[0])) {
            firstEqual = true;
          }

          // If they are both NaN, then they are equal
          if (!secondEqual && isNaN(a[1]) && isNaN(b[1])) {
            secondEqual = true;
          }
          return firstEqual && secondEqual;
        }
        return a === b;
    }

    popup.select(".ok").on("click", function () {
      applyMapping(act);
      popup.remove();
      popupBG.remove();
    });
    popup.select('.cancel').on('click', function () {
      selectedColumn.mapping(bak);
      $button.classed('filtered', !isSamePairs(bak.range(), original.range()) || !isSamePairs(bak.domain(), original.domain()));
      popup.remove();
      popupBG.remove();
    });
    popup.select('.reset').on('click', function () {
      act = bak = original;
      applyMapping(original);
      editor = LineUp.mappingEditor(bak, original.domain(), that.storage.rawdata, access, editorOptions, that);
      popup.selectAll('.mappingArea *').remove();
      popup.select('.mappingArea').call(editor);
    });
  };

  /**
   * handles the rendering and action of StackedColumn options menu
   * @param selectedColumn -- the stacked column
   */
  LineUp.prototype.stackedColumnOptionsGui = function (selectedColumn) {
    //console.log(selectedColumn);
    var config = this.config;
    var overlay = this.$header.select('.overlay');
    var that = this;
    // remove when clicked on already selected item
    var disappear = (this.stackedColumnModified === selectedColumn);
    if (disappear) {
      overlay.selectAll('.stackedOption').remove();
      this.stackedColumnModified = null;
      return;
    }



    function removeStackedColumn(col) {
      that.storage.removeColumn(col);

      that.listeners['columns-changed'](that);

      that.headerUpdateRequired = true;
      that.updateAll();
    }

    function renameStackedColumn(col) {
      var x = +(this.$container.node().clientWidth) / 2 - 100;
      //   var y = +100;
      var y = 0;

      var popupBG = this.$container.append('div')
        // var popupBG = d3.select("body").append("div")
        .attr("class", "lu-popupBG");

        // ATS: Was d3.select('body').appe...
      var popup = this.$container.append('div')
        .attr({
          'class': 'lu-popup'
        }).style({
          left: x + 'px',
          top: y + 'px',
          width: '200px',
          height: '70px'

        })
        .html(
          '<div style="font-weight: bold"> rename column: </div>' +
          '<input type="text" id="popupInputText" size="20" value="' + col.label + '"><br>' +
          '<button class="cancel"><i class="fa fa-times"></i> cancel</button>' +
          '<button class="ok"><i class="fa fa-check"></i> ok</button>'
      );

      function getElementById(id) {
        return $(that.$container.node()).find("#" + id)[0];
      }

      popup.select('.ok').on('click', function() {
        var newValue = getElementById('popupInputText').value;
        if (newValue.length > 0) {
          col.label = newValue;
          that.updateHeader(that.storage.getColumnLayout(col.columnBundle));
          that.listeners['columns-changed'](that);
          popup.remove();
          popupBG.remove();
        } else {
          window.alert('non empty string required');
        }
      });

      popup.select('.cancel').on('click', function () {
        popup.remove();
        popupBG.remove();
      });
    }

    // else:
    this.stackedColumnModified = selectedColumn;
    var options = [
      {name: '\uf014 remove', action: removeStackedColumn},
      {name: '\uf044 rename', action: renameStackedColumn},
      {name: '\uf0ae re-weight', action: that.reweightStackedColumnDialog}
    ];

    var menuLength = options.length * 100;

    var stackedOptions = overlay.selectAll('.stackedOption').data([
      {d: selectedColumn, o: options}
    ]);
    stackedOptions.exit().remove();


    var stackedOptionsEnter = stackedOptions.enter().append('div')
      .attr({
        'class': 'stackedOption'
      })
      .style({
        "position": "absolute",
        "left": function (d) {
          return (d.d.offsetX + d.d.columnWidth - menuLength) + "px";
        },
        top: "calc(" + (config.htmlLayout.headerHeight / 2 - 2) + "px - .5em)",
        "background-color": "white",
        width: menuLength + "px",
        height: (config.htmlLayout.headerHeight / 2 - 4) + "px"
      });
    stackedOptionsEnter.selectAll('.stackedOption-action').data(function (d) {
      return d.o;
    }).enter().append('div')
      .attr({
        "class": "stackedOption-action"
      })
      .style({
        position: "absolute",
        left: function (d, i) {
          return (i * 100 + 5) + "px";
        },
        top: "calc(" + (config.htmlLayout.headerHeight / 4 - 2) + "px - .5em)"
      })
      .text(function (d) {
        return d.name;
      });

    stackedOptions.selectAll('.stackedOption-action').on('click', function (d) {
      overlay.selectAll('.stackedOption').remove();
      d.action.call(that, selectedColumn);
      d3.event.preventDefault();
      d3.event.stopPropagation();
    });

    stackedOptions.transition().style({
      position: "absolute",
      left: function (d) {
        return (d.d.offsetX + d.d.columnWidth - menuLength) + "px";
      },
      top: "calc(" + (config.htmlLayout.headerHeight / 2 - 2) + "px - .5em)"
    });
  };

  LineUp.prototype.openCategoricalFilterPopup = function (column, $button) {
    if (!(column instanceof LineUp.LayoutCategoricalColumn)) {
      //can't filter other than string columns
      return;
    }
    var bak = column.filter || [];
    var popupBG = this.$container.append('div')
          // var popupBG = d3.select("body").append("div")
      .attr("class", "lu-popupBG");

    var popup = this.$container.append('div')
      .attr({
        'class': 'lu-popup'
      }).style({
        left: +(this.$container.node().clientWidth) / 2 - 100,
        top: "0px",
        width: (400) + 'px',
        // height: (300) + 'px'
      })
      .html(
      '<span style="font-weight: bold">Edit Filter</span>' +
      '<form onsubmit="return false">' +
      '<div class="selectionTable"><table><thead><th></th><th>Category</th></thead><tbody></tbody></table></div>' +
      '<button class="ok"><i class="fa fa-check" title="ok"></i></button>' +
      '<button class="cancel"><i class="fa fa-times" title="cancel"></i></button>' +
      '<button class="reset"><i class="fa fa-undo" title="reset"></i></button></form>'
    );

    popup.select('.selectionTable').style({
      width: (400 - 10) + 'px',
      height: (300 - 40) + 'px'
    });

    var that = this;


    // list all data rows !
    var trData = column.column.categories.map(function (d) {
      return {d: d, isChecked: bak.length === 0 || bak.indexOf(d) >= 0};
    });

    var trs = popup.select('tbody').selectAll('tr').data(trData);
    trs.enter().append('tr');
    trs.append('td').attr('class', 'checkmark');
    trs.append('td').attr('class', 'datalabel').text(function (d) {
      return d.d;
    });

    function redraw() {
      var trs = popup.select('tbody').selectAll('tr').data(trData);
      trs.select('.checkmark').html(function (d) {
        return '<i class="fa fa-' + ((d.isChecked) ? 'check-' : '') + 'square-o"></i>';
      })
      .on('click', function (d) {
        d.isChecked = !d.isChecked;
        redraw();
      });
      trs.select('.datalabel').style('opacity', function (d) {
        return d.isChecked ? '1.0' : '.8';
      });
    }
    redraw();

    function updateData(filter) {
      var oldFilter = column.filter || false; // Forces falsy values to false
      filter = filter || false;
      if (oldFilter !== filter) {
        column.filter = filter;
        $button.classed('filtered', (filter && filter.length > 0 && filter.length < column.column.categories.length));
        that.listeners['change-filter'](that, column);
        if (!that.config.filtering || !that.config.filtering.external) {
          that.storage.resortData({filteredChanged: true});
        }
        that.updateBody();
      }
    }

    popup.select('.cancel').on('click', function () {
      updateData(bak);
      popup.remove();
      popupBG.remove();
    });
    popup.select('.reset').on('click', function () {
      trData.forEach(function (d) {
        d.isChecked = true;
      });
      redraw();
      updateData(null);
    });
    popup.select('.ok').on('click', function () {
      var f = trData.filter(function (d) {
        return d.isChecked;
      }).map( function (d) {
        return d.d;
      });
      if (f.length === column.column.categories.length) {
        f = [];
      }
      updateData(f);
      popup.remove();
      popupBG.remove();
    });
  };

  LineUp.prototype.openFilterPopup = function (column, $button) {
    if (!(column instanceof LineUp.LayoutStringColumn)) {
      //can't filter other than string columns
      return;
    }
    // var pos = $(this.$header.node()).offset();
    // pos.left += column.offsetX;
    // // pos.top += column.offsetY;
    var pos = {
      left: column.offsetX,
      top: 0
    //   top: column.offsetY
    };
    var bak = column.filter || '';

    var popupBG = this.$container.append('div')
      // var popupBG = d3.select("body").append("div")
      .attr("class", "lu-popupBG");

    var popup = this.$container.append('div')
      .attr({
        'class': 'lu-popup2'
      }).style({
        left: pos.left + 'px',
        top: pos.top + 'px'
      })
      .html(
        '<form onsubmit="return false"><input type="text" id="popupInputText" placeholder="containing..." autofocus="true" size="18" value="' + bak + '"><br>' +
        '<button class="ok"><i class="fa fa-check" title="ok"></i></button>' +
        '<button class="cancel"><i class="fa fa-times" title="cancel"></i></button>' +
        '<button class="reset"><i class="fa fa-undo" title="reset"></i></button></form>'
    );

    var that = this;

    function updateData(filter) {
      var oldFilter = column.filter || false; // Forces falsy values to false
      filter = filter || false;
      if (oldFilter !== filter) {
        column.filter = filter;
        $button.classed('filtered', (filter && filter.length > 0));
        that.listeners['change-filter'](that, column);
        if (!that.config.filtering || !that.config.filtering.external) {
          that.storage.resortData({filteredChanged: true});
        }
        that.updateBody();
      }
    }

    function getElementById(id) {
      return $(that.$container.node()).find("#" + id)[0];
    }

    popup.select('.cancel').on('click', function () {
      getElementById('popupInputText').value = bak;
      updateData(bak);
      popup.remove();
      popupBG.remove();
    });
    popup.select('.reset').on('click', function () {
      getElementById('popupInputText').value = '';
      updateData(null);
    });
    popup.select('.ok').on('click', function () {
      updateData(getElementById('popupInputText').value);
      popup.remove();
      popupBG.remove();
    });
  };

  LineUp.createTooltip = function (container) {
    var $container = $(container), $tooltip = $('<div class="lu-tooltip"/>').appendTo($container);

    function showTooltip(content, xy) {
      $tooltip.html(content).css({
        left: xy.x + 'px',
        top: (xy.y + xy.height - $container.offset().top) + 'px'
      }).fadeIn();

      var stickout = ($(window).height() + $(window).scrollTop()) <= ((xy.y + xy.height) + $tooltip.height() - 20);
      var stickouttop = $(window).scrollTop() > (xy.y - $tooltip.height());
      if (stickout && !stickouttop) { //if the bottom is not visible move it on top of the box
        $tooltip.css('top', (xy.y - $tooltip.height() - $container.offset().top) + 'px');
      }
    }

    function hideTooltip() {
      $tooltip.stop(true).hide();
    }

    function moveTooltip(xy) {
      if (xy.x) {
        $tooltip.css({
          left: xy.x + 'px'
        });
      }
      if (xy.y) {
        $tooltip.css({
          top: xy.y  - $container.offset().top + 'px'
        });
      }
    }

    function sizeOfTooltip() {
      return [$tooltip.width(), $tooltip.height()];
    }

    function destroyTooltip() {
      $tooltip.remove();
    }

    return {
      show: showTooltip,
      hide: hideTooltip,
      move: moveTooltip,
      size: sizeOfTooltip,
      destroy: destroyTooltip
    };
  };

  LineUp.prototype.initScrolling = function ($container, topShift) {
    var that = this,
      container = $container[0],
      rowHeight = this.config.svgLayout.rowHeight + this.config.svgLayout.rowPadding,
      prevScrollTop = container.scrollTop,
      jbody = $(this.$table.node()),
      backupRows = this.config.svgLayout.backupScrollRows,
      shift;

    function onScroll() {
      var act = container.scrollTop;
      var left = container.scrollLeft;
      //at least one row changed
      that.scrolled(act, left);
      if (Math.abs(prevScrollTop - act) >= rowHeight * (backupRows / 2)) {
        prevScrollTop = act;
        that.updateBody();
      }
    }

    $container.on('scroll', onScroll);
    //the shift between the scroll container our svg body
    shift = jbody.offset().top - $container.offset().top + topShift;
    //use a resize sensor of a utility lib to also detect resize changes
    //new ResizeSensor($container, function() {
    //  console.log(container.scrollHeight, container.scrollTop, $container.innerHeight(), $container.height(), 'resized');
    //  that.updateBody();
    //});
    function selectVisibleRows(data, rowScale) {
      var top = container.scrollTop - shift,
        bottom = top + $container.innerHeight(),
        i = 0, j;
      /*console.log(window.matchMedia('print').matches, window.matchMedia('screen').matches, top, bottom);
      if (typeof window.matchMedia === 'function' && window.matchMedia('print').matches) {
        console.log('show all');
        return [0, data.length];
      }*/
      if (top > 0) {
        i = Math.round(top / rowHeight);
        //count up till really even partial rows are visible
        while (i >= 0 && rowScale(data[i + 1]) > top) {
          i--;
        }
        i -= backupRows; //one more row as backup for scrolling
      }
      { //some parts from the bottom aren't visible
        j = Math.round(bottom / rowHeight);
        //count down till really even partial rows are visible
        while (j <= data.length && rowScale(data[j - 1]) < bottom) {
          j++;
        }
        j += backupRows; //one more row as backup for scrolling
      }
      return [Math.max(i, 0), Math.min(j, data.length)];
    }

    return {
      selectVisible: selectVisibleRows,
      onScroll: onScroll
    };
  };

  LineUp.prototype.initDragging = function () {
    var that = this;
    /*
     * define dragging behaviour for header weights
     * */

    function dragWeightStarted() {
      d3.event.sourceEvent.stopPropagation();
      d3.select(this).classed('dragging', true);
    }


    function draggedWeight() {
      var newValue = Math.max(d3.mouse(this.parentNode)[0], that.config.htmlLayout.handleWidth / 2);
      that.reweightHeader({column: d3.select(this).data()[0], value: newValue});
      that.updateBody(that.storage.getColumnLayout(), that.storage.getData(), false);
    }

    function dragWeightEnded() {
      d3.select(this).classed('dragging', false);

      if (that.config.columnBundles.primary.sortedColumn instanceof LineUp.LayoutStackedColumn) {
        that.listeners['change-sortcriteria'](that, that.config.columnBundles.primary.sortedColumn);
        if (!that.config.sorting || !that.config.sorting.external) {
          that.storage.resortData({column: that.config.columnBundles.primary.sortedColumn});
        }
        that.updateBody(that.storage.getColumnLayout(), that.storage.getData(), false);
      }
//        that.updateBody(that.storage.getColumnLayout(), that.storage.getData())

//      that.updateAll();
      // TODO: integrate columnbundles dynamically !!
    }


    return d3.behavior.drag()
      .origin(function (d) {
        return d;
      })
      .on('dragstart', dragWeightStarted)
      .on('drag', draggedWeight)
      .on('dragend', dragWeightEnded);
  };
}(LineUp || (LineUp = {}), d3, jQuery));

/* global d3, jQuery */
var LineUp;

(function (LineUp, d3, $) {
  'use strict';
  function addLine($svg, x1, y1, x2, y2, clazz) {
    return $svg.append("line").attr({
      x1 : x1, y1 : y1, x2 : x2, y2: y2, 'class' : clazz
    });
  }
  function addText($svg, x, y, text, dy, clazz, clipSource, name, anchor) {
    dy = dy || null;
    clazz = clazz || null;
    return $svg.append("text").attr({
      x : x, y : y, dy : dy, 'class' : clazz,
      'clip-path': 'url('+ clipSource +'#clip-H' + name + ')',
      'text-anchor': anchor
    }).text(text);
  }
  function addCircle($svg, x, shift, y, radius) {
    shift -= x;
    return $svg
      .append("circle")
      .attr({
        'class' : 'handle',
        r : radius,
        cx: x,
        cy : y,
        transform : 'translate('+shift+',0)'
      });
  }
      
  function prettyPrintNumber(num) {
    if (typeof num !== "undefined" && num !== null) {
      if ((num + "").length <= 5) {
        return num;
      } else if (num.toExponential) {
        return num.toExponential(1);
      } else if (num.substring) {
        return num.substring(0, 3) + "...";
      }
      return num;
    }
    return "";
  }

  LineUp.mappingEditor = function (scale, dataDomain, data, data_accessor, options, lineup) {
    //Get and set the clip source to be used for rendering overlays. Scoping context to a related DOM element.
    var clipSource = lineup.getClipSource.apply(lineup.$container[0][0]);
    
    options = $.extend({
      width: 400,
      height: 400,
      padding: 50,
      radius: 10,
      callback: $.noop,
      callbackThisArg : null,
      triggerCallback: 'change' //change, dragend
    }, options);

    var editor = function ($root) {
      var $svg = $root.append('svg').attr({
        'class': 'lugui-me',
        width: options.width,
        height: options.height
      });
      //left limit for the axes
      var lowerLimitX = options.padding;
      //right limit for the axes
      var upperLimitX = options.width-options.padding;
      //location for the score axis
      var scoreAxisY = options.padding;
      //location for the raw2pixel value axis
      var raw2pixelAxisY = options.height-options.padding;
      //this is needed for filtering the shown datalines
      var raw2pixel = d3.scale.linear().domain(dataDomain).range([lowerLimitX, upperLimitX]);
      var normal2pixel = d3.scale.linear().domain([0,1]).range([lowerLimitX,upperLimitX]);

      //x coordinate for the score axis lower bound
      var lowerNormalized = normal2pixel(scale.range()[0]);
      //x coordinate for the score axis upper bound
      var upperNormalized = normal2pixel(scale.range()[1]);
      
      var domain = scale.domain();
      if (isNaN(domain[0])) {
        domain[0] = 0;
      }
      if (isNaN(domain[1])) {
        domain[1] = 0;
      }
      //x coordinate for the raw2pixel axis lower bound
      var lowerRaw = raw2pixel(domain[0]);
      //x coordinate for the raw2pixel axis upper bound
      var upperRaw = raw2pixel(domain[1]);

      scale = d3.scale.linear()
        .clamp(true)
        .domain(domain)
        .range([lowerNormalized, upperNormalized]);
      
      var paths = [
        { name: "score_min", x: lowerLimitX, y:scoreAxisY - 25, width: 40, height: 20 },
        { name: "score_max", x: upperLimitX - 40 /* width */, y:scoreAxisY - 25, width: 40, height: 20 },
        { name: "value_min", x: lowerLimitX, y:raw2pixelAxisY + 20, width: 45, height: 20 },
        { name: "value_max", x: upperLimitX - 45 /* width */, y: raw2pixelAxisY + 20, width: 45, height: 20 }
      ];
      
      $svg.append('defs');
      
      var textClipPath = $svg.select('defs').selectAll(function () {
        return this.getElementsByTagName('clipPath');
      }).data(paths, function(d) { return d.name; });
      textClipPath.enter().append('clipPath')
        .attr('id', function(d) { return 'clip-H' + d.name; })
        .append('rect');
        
      textClipPath.exit().remove();
      textClipPath.select('rect')
        .attr({
          x: function(d) { return d.x; },
          y: function(d) { return d.y; },
          width: function(d) { return d.width; },
          height: function(d) { return d.height; } 
      });
      
      var $base = $svg.append('g');
      //upper axis for scored values
      addLine($base, lowerLimitX,scoreAxisY, upperLimitX, scoreAxisY, 'axis');
      //label for minimum scored value
      addText($base, lowerLimitX, scoreAxisY - 25, 0, '.75em', undefined, clipSource, "score_min", "start");
      //label for maximum scored value
      addText($base, upperLimitX, scoreAxisY - 25, 1, '.75em', undefined, clipSource, "score_max", "end");
      addText($base, options.width/2, scoreAxisY -25, 'Score', '.75em','centered', clipSource, "score", "middle");

      //lower axis for raw2pixel values
      addLine($base, lowerLimitX,raw2pixelAxisY, upperLimitX, raw2pixelAxisY, 'axis');
      //label for minimum raw2pixel value
      addText($base, lowerLimitX, raw2pixelAxisY + 20, prettyPrintNumber(dataDomain[0]), '.75em', undefined, clipSource, "value_min", "start");
      //label for maximum raw2pixel value
      addText($base, upperLimitX, raw2pixelAxisY + 20, prettyPrintNumber(dataDomain[1]), '.75em', undefined, clipSource, "value_max", "end");
      addText($base, options.width/2, raw2pixelAxisY + 20, 'Raw', '.75em','centered', clipSource, "value", "middle");
      
      //lines that show mapping of individual data items
      var datalines = $svg.append('g').classed('data',true).selectAll('line').data(data);
      datalines.enter().append('line')
        .attr({
          x1: function (d) { return scale(data_accessor(d)); },
          y1: scoreAxisY,
          x2: function (d) { return raw2pixel(data_accessor(d)); },
          y2: raw2pixelAxisY
        }).style('visibility', function(d) {
          var a;
          if (lowerRaw < upperRaw) {
            a = (raw2pixel(data_accessor(d)) < lowerRaw || raw2pixel(data_accessor(d)) > upperRaw);
          } else {
            a = (raw2pixel(data_accessor(d)) > lowerRaw || raw2pixel(data_accessor(d)) < upperRaw);
          }
          return a ? 'hidden' : null;
        });
      //line that defines lower bounds for the scale
      var mapperLineLowerBounds = addLine($svg, lowerNormalized, scoreAxisY, lowerRaw, raw2pixelAxisY, 'bound');
      //line that defines upper bounds for the scale
      var mapperLineUpperBounds = addLine($svg, upperNormalized, scoreAxisY, upperRaw, raw2pixelAxisY, 'bound');
      //label for lower bound of normalized values
      var lowerBoundNormalizedLabel = addText($svg, lowerLimitX + 5, scoreAxisY - 15, d3.round(normal2pixel.invert(lowerNormalized), 2), '.25em', 'drag').attr('transform','translate('+(lowerNormalized-lowerLimitX)+',0)');
      //label for lower bound of raw2pixel values
      var lowerBoundRawLabel = addText($svg, lowerLimitX + 5, raw2pixelAxisY - 15, d3.round(raw2pixel.invert(lowerRaw), 2), '.25em', 'drag').attr('transform','translate('+(lowerRaw-lowerLimitX)+',0)');
      //label for upper bound of normalized values
      var upperBoundNormalizedLabel = addText($svg, upperLimitX + 5, scoreAxisY - 15, d3.round(normal2pixel.invert(upperNormalized), 2), '.25em', 'drag').attr('transform','translate('+(upperNormalized-upperLimitX)+',0)');
      //label for upper bound of raw2pixel values
      var upperBoundRawLabel = addText($svg, upperLimitX + 5, raw2pixelAxisY - 15, d3.round(raw2pixel.invert(upperRaw), 2), '.25em', 'drag').attr('transform','translate('+(upperRaw-upperLimitX)+',0)');

      function createDrag(label, move) {
        return d3.behavior.drag()
          .on('dragstart', function () {
            d3.select(this)
              .classed('dragging', true)
              .attr('r', options.radius * 1.1);
            label.style('visibility', 'visible');
          })
          .on('drag', move)
          .on('dragend', function () {
            d3.select(this)
              .classed('dragging', false)
              .attr('r', options.radius);
            label.style('visibility', null);
            updateScale(true);
          })
          .origin(function () {
            var t = d3.transform(d3.select(this).attr('transform'));
            return {x: t.translate[0], y: t.translate[1]};
          });
      }

      function updateNormalized() {
        scale.range([lowerNormalized, upperNormalized]);
        datalines.attr('x1', function (d) {
          return scale(data_accessor(d));
        });
        updateScale();
      }

      function updateRaw() {
        var hiddenDatalines, shownDatalines;
        if (lowerRaw < upperRaw) {
          hiddenDatalines = datalines.filter(function (d) {
            return (raw2pixel(data_accessor(d)) < lowerRaw || raw2pixel(data_accessor(d)) > upperRaw);
          });
          shownDatalines = datalines.filter(function (d) {
            return !(raw2pixel(data_accessor(d)) < lowerRaw || raw2pixel(data_accessor(d)) > upperRaw);
          });
        }
        else {
          hiddenDatalines = datalines.filter(function (d) {
            return (raw2pixel(data_accessor(d)) > lowerRaw || raw2pixel(data_accessor(d)) < upperRaw);
          });
          shownDatalines = datalines.filter(function (d) {
            return !(raw2pixel(data_accessor(d)) > lowerRaw || raw2pixel(data_accessor(d)) < upperRaw);
          });
        }
        hiddenDatalines.style('visibility', 'hidden');
        scale.domain([raw2pixel.invert(lowerRaw), raw2pixel.invert(upperRaw)]);
        shownDatalines
          .style('visibility', null)
          .attr('x1', function (d) {
            return scale(data_accessor(d));
          });
        updateScale();
      }

      //draggable circle that defines the lower bound of normalized values
      addCircle($svg, lowerLimitX, lowerNormalized, scoreAxisY, options.radius)
        .call(createDrag(lowerBoundNormalizedLabel, function () {
          if (d3.event.x >= 0 && d3.event.x <= (upperLimitX - lowerLimitX)) {
            mapperLineLowerBounds.attr('x1', lowerLimitX + d3.event.x);
            d3.select(this)
              .attr('transform', 'translate(' + d3.event.x + ', 0)');
            lowerNormalized = d3.event.x + lowerLimitX;
            lowerBoundNormalizedLabel
              .text(d3.round(normal2pixel.invert(lowerNormalized), 2))
              .attr('transform', 'translate(' + d3.event.x + ', 0)');
            updateNormalized();
          }
        }));
      //draggable circle that defines the upper bound of normalized values
      addCircle($svg, upperLimitX, upperNormalized, scoreAxisY, options.radius)
        .call(createDrag(upperBoundNormalizedLabel, function () {
          if (d3.event.x >= (-1 * (upperLimitX - lowerLimitX)) && d3.event.x <= 0) {
            mapperLineUpperBounds.attr('x1', upperLimitX + d3.event.x);
            d3.select(this)
              .attr('transform', 'translate(' + d3.event.x + ', 0)');
            upperNormalized = d3.event.x + upperLimitX;
            upperBoundNormalizedLabel
              .text(d3.round(normal2pixel.invert(upperNormalized), 2))
              .attr('transform', 'translate(' + d3.event.x + ', 0)');
            updateNormalized();
          }
        }));
      //draggable circle that defines the lower bound of raw2pixel values
      addCircle($svg, lowerLimitX, lowerRaw, raw2pixelAxisY, options.radius)
        .call(createDrag(lowerBoundRawLabel, function () {
          if (d3.event.x >= 0 && d3.event.x <= (upperLimitX - lowerLimitX)) {
            mapperLineLowerBounds.attr('x2', lowerLimitX + d3.event.x);
            d3.select(this)
              .attr('transform', 'translate(' + d3.event.x + ', 0)');
            lowerRaw = d3.event.x + lowerLimitX;
            lowerBoundRawLabel
              .text(d3.round(raw2pixel.invert(lowerRaw), 2))
              .attr('transform', 'translate(' + d3.event.x + ', 0)');
            updateRaw();
          }
        }));
      //draggable circle that defines the upper bound of raw2pixel values
      addCircle($svg, upperLimitX, upperRaw, raw2pixelAxisY, options.radius)
        .call(createDrag(upperBoundRawLabel, function () {
          if (d3.event.x >= (-1 * (upperLimitX - lowerLimitX)) && d3.event.x <= 0) {
            mapperLineUpperBounds.attr('x2', upperLimitX + d3.event.x);
            d3.select(this)
              .attr('transform', 'translate(' + d3.event.x + ', 0)');
            upperRaw = d3.event.x + upperLimitX;
            upperBoundRawLabel
              .text(d3.round(raw2pixel.invert(upperRaw), 2))
              .attr('transform', 'translate(' + d3.event.x + ', 0)');
            updateRaw();
          }
        }));

      function updateScale(isDragEnd) {
        if (isDragEnd !== (options.triggerCallback === 'dragend')) {
          return;
        }
        var newScale = d3.scale.linear()
          .domain([raw2pixel.invert(lowerRaw), raw2pixel.invert(upperRaw)])
          .range([normal2pixel.invert(lowerNormalized), normal2pixel.invert(upperNormalized)]);
        options.callback.call(options.callbackThisArg, newScale);
      }
    };
    return editor;
  };
}(LineUp || (LineUp = {}), d3, jQuery));
 

/* global d3, jQuery, _ */
var LineUp;
(function (LineUp, d3, $, _, undefined) {

  function bundleSetter(bundle) {
    return function setBundle(col) {
      col.columnBundle = bundle;
      if (col instanceof LineUp.LayoutStackedColumn) {
        col.children.forEach(setBundle);
      }
    };
  }
  /**
   * An implementation of data storage for reading locally
   * @param tableId
   * @param data
   * @param columns
   * @param config
   * @class
   */
  function LineUpLocalStorage(data, columns, layout, primaryKey, storageConfig) {
    this.storageConfig = $.extend(true, {}, {
      colTypes: {
        'number': LineUp.LineUpNumberColumn,
        'string': LineUp.LineUpStringColumn,
        'categorical': LineUp.LineUpCategoricalColumn
      },
      layoutColumnTypes: {
        'number': LineUp.LayoutNumberColumn,
        'single': LineUp.LayoutStringColumn,
        'string': LineUp.LayoutStringColumn,
        'categorical': LineUp.LayoutCategoricalColumn,
        'categoricalcolor': LineUp.LayoutCategoricalColorColumn,
        'stacked': LineUp.LayoutStackedColumn,
        'rank': LineUp.LayoutRankColumn,
        'actions': LineUp.LayoutActionColumn
      }
    }, storageConfig);
    this.config = null; //will be injected by lineup

    var colTypes = this.storageConfig.colTypes;
    var layoutColumnTypes = this.storageConfig.layoutColumnTypes;
    var that = this;

    function toColumn(desc) {
      return new colTypes[desc.type](desc, toColumn, data);
    }

    this.storageConfig.toColumn = toColumn;

    this.primaryKey = primaryKey;
    this.rawdata = data;
    this.selected = d3.set();
    this.rawcols = columns.map(toColumn);
    this.layout = layout || LineUpLocalStorage.generateDefaultLayout(this.rawcols);

    var colLookup = d3.map();
    this.rawcols.forEach(function (col) {
      colLookup.set(col.column, col);
    });
    function toLayoutColumn(desc) {
      var type = desc.type || 'single';
      if (type === 'single') {
        var col = colLookup.get(desc.column);
        if (col instanceof LineUp.LineUpNumberColumn) {
          type = 'number';
        } else if (col instanceof LineUp.LineUpCategoricalColumn) {
          type = 'categorical';
        }
      }
      return new layoutColumnTypes[type](desc, colLookup, toLayoutColumn, that);
    }

    this.storageConfig.toLayoutColumn = toLayoutColumn;

    var bundles = this.bundles = {};
    Object.keys(this.layout).forEach(function(l) {
      bundles[l] = {
        layoutColumns: [],
        needsLayout: true,  // this triggers the layout generation at first access to "getColumnLayout"
        data: data,
        initialSort :true
      };
    });
  }

  LineUp.LineUpLocalStorage = LineUpLocalStorage;
  LineUp.createLocalStorage = function (data, columns, layout, primaryKey, storageConfig) {
    return new LineUpLocalStorage(data, columns, layout, primaryKey, storageConfig);
  };

  /**
   * generate a default layout by just showing all columns with 100 px
   * @param columns
   * @returns {{primary: (Array|*)}}
   */
  LineUpLocalStorage.generateDefaultLayout = function (columns) {
    var layout = columns.map(function (c) {
      return {
        column: c.column,
        width: c instanceof LineUp.LineUpStringColumn ? 200 : 100
      };
    });
    return {
      primary: layout
    };
  };

  LineUpLocalStorage.prototype = $.extend({}, {},
    /** @lends LineUpLocalStorage.prototype */
    {
      getRawColumns: function () {
        return this.rawcols;
      },
      getColumnLayout: function (key) {
        var _key = key || "primary";
        if (this.bundles[_key].needsLayout) {
          this.generateLayout(this.layout, _key);
          this.bundles[_key].needsLayout = false;
        }

        return this.bundles[_key].layoutColumns;
      },

      isSelected : function(row) {
        return this.selected.has(row[this.primaryKey]);
      },
      select : function(row) {
        this.selected.add(row[this.primaryKey]);
      },
      selectAll : function(rows) {
        var that = this;
        rows.forEach(function(row) {
          that.selected.add(row[that.primaryKey]);
        });
      },
      setSelection: function(rows) {
        this.clearSelection();
        this.selectAll(rows);
      },
      deselect: function(row) {
        this.selected.remove(row[this.primaryKey]);
      },
      selectedRows: function() {
        return this.rawdata.filter(this.isSelected.bind(this));
      },
      clearSelection : function() {
        this.selected = d3.set();
      },

      /**
       *  get the data
       *  @returns data
       */
      getData: function (bundle) {
        bundle = bundle || "primary";
        return this.bundles[bundle].data;
      },
      filterData: function (columns) {
        var flat = [];
        columns.forEach(function (d) {
          d.flattenMe(flat);
        });
        flat = flat.filter(function (d) {
          return d.isFiltered();
        });
        if ($.isFunction(this.config.filter.filter)) {
          flat.push(this.config.filter.filter);
        }
        if (flat.length === 0) {
          return this.rawdata;
        } else {
          return this.rawdata.filter(function (row) {
            return flat.every(function (f) {
              return f.filterBy(row);
            });
          });
        }
      },
      resortData: function (spec) {

        var _key = spec.key || 'primary', that = this;
        var bundle = this.bundles[_key];
        var asc = spec.asc || this.config.columnBundles[_key].sortingOrderAsc;
        var column = spec.column || this.config.columnBundles[_key].sortedColumn;

        //console.log('resort: ', spec);
        var cols = this.getColumnLayout(_key);
        bundle.data = this.filterData(cols);
        if (spec.filteredChanged || bundle.initialSort) {
          //trigger column updates
          var flat = [];
          cols.forEach(function (d) {
            d.flattenMe(flat);
          });
          var generator = that.config.histograms && that.config.histograms.generator;
          flat.forEach(function (col) {
            col.prepare(bundle.data, that.config.renderingOptions.histograms, generator);
          });
          bundle.initialSort = false;
        }
        var primary = this.primaryKey;
        function sort(a,b) {
          var r = column.sortBy(a,b);
          if (r === 0 || isNaN(r)) { //by default sort by primary key
            return d3.ascending(a[primary], b[primary]);
          }
          return asc ? -r : r;
        }
        if (column) {
          bundle.data.sort(sort);
        }

        var start = this.config.filter.skip ? this.config.filter.skip : 0;
        if ((this.config.filter.limit && isFinite(this.config.filter.limit))) {
          bundle.data = bundle.data.slice(start, start + this.config.filter.limit);
        } else {
          bundle.data = bundle.data.slice(start);
        }

        var rankColumn = bundle.layoutColumns.filter(function (d) {
          return d instanceof LineUp.LayoutRankColumn;
        });
        if (rankColumn.length > 0) {
          var accessor = function (d, i) {
            return i;
          };
          if (column) {
            accessor = function (d) {
              return column.getValue(d);
            };
          }
          this.assignRanks(bundle.data, accessor, rankColumn);
        }
      },
      /*
       * assigns the ranks to the data which is expected to be sorted in decreasing order
       * */
      assignRanks: function (data, accessor, rankColumns) {

        var actualRank = 1;
        var actualValue = -1;

        data.forEach(function (row, i) {
          if (actualValue === -1) {
            actualValue = accessor(row, i);
          }
          if (actualValue !== accessor(row, i)) {
            actualRank = i + 1; //we have 1,1,3, not 1,1,2
            actualValue = accessor(row, i);
          }
          rankColumns.forEach(function (r) {
            r.setValue(row, actualRank);
          });
        });
      },
      generateLayout: function (layout, bundle) {
        var _bundle = bundle || 'primary';

        // create Rank Column
//            new LayoutRankColumn();

        var b = this.bundles[_bundle];
        b.layoutColumns = layout[_bundle].map(this.storageConfig.toLayoutColumn);

        //console.log(b.layoutColumns, layout);
        //if there is no rank column create one
        if (b.layoutColumns.filter(function (d) {
          return d instanceof LineUp.LayoutRankColumn;
        }).length < 1) {
          b.layoutColumns.unshift(new LineUp.LayoutRankColumn(null, null, null, this));
        }

        //if we have row actions and no action column create one
        if (this.config.svgLayout.rowActions.length > 0 && b.layoutColumns.filter(function (d) {
          return d instanceof LineUp.LayoutActionColumn;
        }).length < 1) {
          b.layoutColumns.push(new LineUp.LayoutActionColumn());
        }

        //set layout bundle reference
        b.layoutColumns.forEach(bundleSetter(_bundle));
      },
      addColumn: function (col, bundle, position) {
        var _bundle = bundle || 'primary';
        var cols = this.bundles[_bundle].layoutColumns, i, c;
        //insert the new column after the first non rank, text column
        if (typeof position === 'undefined' || position === null) {
          for (i = 0; i < cols.length; ++i) {
            c = cols[i];
            if (c instanceof LineUp.LayoutRankColumn || (c instanceof LineUp.LayoutStringColumn)) {
              continue;
            }
            break;
          }
        } else {
          if (position < 0) {
            position = cols.length + 1 + position;
          }
          i =  Math.max(0, Math.min(cols.length, position));
        }
        col.columnBundle = _bundle;
        cols.splice(i, 0, col);
      },
      addStackedColumn: function (spec, position, bundle) {
        var _spec = $.extend({ type: 'stacked', label: 'Stacked', children: []}, spec);
        this.addColumn(this.storageConfig.toLayoutColumn(_spec), bundle, position);
      },
      addSingleColumn: function (spec, position, bundle) {
        this.addColumn(this.storageConfig.toLayoutColumn(spec), bundle, position);
      },

      removeColumn: function (col) {
        var headerColumns = this.bundles[col.columnBundle].layoutColumns;

        if (col instanceof LineUp.LayoutStackedColumn) {
          var indexOfElement = _.indexOf(headerColumns, col);//function(c){ return (c.id == d.id)});
          if (indexOfElement !== undefined) {
            var addColumns = [];
//                d.children.forEach(function(ch){
//
//                    // if there is NO column of same data type
//                   if (headerColumns.filter(function (hc) {return hc.getDataID() == ch.getDataID()}).length ==0){
//                       ch.parent=null;
//                       addColumns.push(ch);
//                   }
//
//                })

//                headerColumns.splice(indexOfElement,1,addColumns)

            Array.prototype.splice.apply(headerColumns, [indexOfElement, 1].concat(addColumns));

          }


        } else if (col.column) {
          if (col.parent === null || col.parent === undefined) {
            headerColumns.splice(headerColumns.indexOf(col), 1);
          } else {
            col.parent.removeChild(col);
            this.resortData({});
          }
        }


      },
      moveColumn: function (column, targetColumn, position) {
        var sourceColumns = this.bundles[column.columnBundle].layoutColumns,
          targetColumns = this.bundles[targetColumn.columnBundle].layoutColumns,
          targetIndex;

        // different cases:
        if (column.parent == null && targetColumn.parent == null) {
          // simple L1 Column movement:

          sourceColumns.splice(sourceColumns.indexOf(column), 1);

          targetIndex = targetColumns.indexOf(targetColumn);
          if (position === 'r') {
            targetIndex++;
          }
          targetColumns.splice(targetIndex, 0, column);
        }
        else if ((column.parent !== null) && targetColumn.parent === null) {
          // move from stacked Column
          column.parent.removeChild(column);

          targetIndex = targetColumns.indexOf(targetColumn);
          if (position === 'r') {
            targetIndex++;
          }
          targetColumns.splice(targetIndex, 0, column);

        } else if (column.parent === null && (targetColumn.parent !== null)) {

          // move into stacked Column
          if (targetColumn.parent.addChild(column, targetColumn, position)) {
            sourceColumns.splice(sourceColumns.indexOf(column), 1);
          }

        } else if ((column.parent !== null) && (targetColumn.parent !== null)) {

          // move from Stacked into stacked Column
          column.parent.removeChild(column);
          targetColumn.parent.addChild(column, targetColumn, position);
        }
        bundleSetter(targetColumn.columnBundle)(column);
        this.resortData({});
      },
      copyColumn: function (column, targetColumn, position) {
        var targetColumns = this.bundles[targetColumn.columnBundle].layoutColumns;

        var newColumn = column.makeCopy();
        bundleSetter(targetColumn.columnBundle)(newColumn);

        // different cases:
        if (targetColumn.parent == null) {

          var targetIndex = targetColumns.indexOf(targetColumn);
          if (position === 'r') {
            targetIndex++;
          }
          targetColumns.splice(targetIndex, 0, newColumn);
        }
        else if ((targetColumn.parent !== null)) {
          // copy into stacked Column
          targetColumn.parent.addChild(newColumn, targetColumn, position);
        }
        this.resortData({});
      },

      /**
       * returns a column by name
       * @param name
       * @param all if true returns all matching columns
       * @returns {*}
       */
      getColumnByName: function (name, all) {
        var cols = this.getColumnLayout().slice(0);
        var result = [];
        for (var i = cols.length - 1; i >= 0; --i) {
          var col = cols[i];
          if (col.getLabel() === name || (col.column && col.column.column === name)) {
            if (!all) {
              return col;
            }
            result.push(col);
          }
          else if (col.children) {
            for (var j = 0; j < col.children.length; j++) {
               cols.unshift(col.children[j]);
               i++;
            }
          }
        }
        return !all ? null : result;
      }
    });
}(LineUp || (LineUp = {}), d3, jQuery, _));

/* global d3, jQuery */
var LineUp;
(function (LineUp, d3, $, undefined) {
  LineUp.prototype = LineUp.prototype || {};
  function updateText(allHeaders, allRows, config) {
    // -- the text columns

    var allTextHeaders = allHeaders.filter(function (d) {
      return d instanceof LineUp.LayoutCategoricalColumn || d instanceof LineUp.LayoutStringColumn|| d instanceof LineUp.LayoutRankColumn;
    });

    var colPadding = config.svgLayout.columnPadding;
    var textRows = allRows.selectAll('.tableData.text')
      .data(function (d) {
        var dd = allTextHeaders.map(function (column) {
          return {
            value: column.getValue(d),
            label: column.getValue(d, 'raw'),
            offsetX: column.offsetX + (colPadding / 2),
            width: Math.max(column.getColumnWidth() - colPadding, 0),
            isRank: (column instanceof LineUp.LayoutRankColumn),
            column: column,
            row: d
          };
        }).filter(function(d) {
          return !!config.cellFormatter || !!d.label;
        });
        return dd;
      });

    function styler (d) {
      return [
        "left:" + d.offsetX + "px",
        "width:" + d.width + "px",
        "line-height:" + config.svgLayout.rowHeight + "px"
      ].join(";");
    }

    var tre = textRows.enter()
      .append('div')
      .attr({
        'class': function (d) {
          return 'tableData text' + (d.isRank ? ' rank' : '');
        },
        style: styler
      });
    textRows.exit().remove();

    textRows
      .attr("style", styler)
      .text(function (d) {
        return d.label;
      });

    if (config.cellFormatter) {
        tre.call(config.cellFormatter);
        textRows.call(config.cellFormatter);
    }

    allRows.selectAll('.tableData.text.rank').text(function (d) {
      return d.label;
    });// only changed texts:
    ///// TODO ---- IMPORTANT  ----- DO NOT DELETE

    //            data.push({key:'rank',value:d['rank']});// TODO: use Rank column
    //    allRows.selectAll('.tableData.text.rank')
//        .data(function(d){
////            console.log(d);
//            return [{key:'rank',value:d['rank']}]
//        }
//    )
  }

    function updateCategorical(allHeaders, allRows, svg, config) {
        // -- the text columns

        var allTextHeaders = allHeaders.filter(function (d) {
            return d instanceof LineUp.LayoutCategoricalColorColumn;
        });

        var icon = (config.svgLayout.rowHeight-config.svgLayout.rowBarPadding*2);
        var textRows = allRows.selectAll('.tableData.cat')
            .data(function (d) {
                var dd = allTextHeaders.map(function (column) {
                    return {
                        value: column.getValue(d),
                        label: column.getValue(d, 'raw'),
                        offsetX: column.offsetX,
                        columnW: column.getColumnWidth(),
                        color: column.getColor(d),
                        clip: 'url(#clip-B' + column.id + ')'
                    };
                });
                return dd;
            });
        textRows.enter()
            .append('rect')
            .attr({
                'class': 'tableData cat',
                y: config.svgLayout.rowBarPadding,
                height: config.svgLayout.rowHeight - config.svgLayout.rowBarPadding*2,
                width: icon
            }).append('title');
        textRows.exit().remove();

        textRows
            .attr('x', function (d) {
                return d.offsetX + 2;
            })
            .style('fill',function (d) {
                return d.color;
            }).select('title').text(function(d) { return d.label; });
    }

  function showStacked(config, lineup) {
    //if not enabled or values are shown
    if (!config.renderingOptions.stacked || config.renderingOptions.values) {
      return false;
    }
    //primary is a stacked one
    var current = config.columnBundles.primary.sortedColumn;
    if (current) {
        if (current && current.column && current.column.column) {
            var matchingCols = lineup.storage.getColumnByName(current.column.column, true);
            for (var i = 0; i < matchingCols.length; i++) {
                if (matchingCols[i].parent instanceof LineUp.LayoutStackedColumn) {
                    return false;
                }
            }
        }
    }
    return !(current && (current.parent instanceof LineUp.LayoutStackedColumn));
  }

  function updateSingleBars(headers, allRows, config) {
    // -- handle the Single columns  (!! use unflattened headers for filtering)
    var allSingleBarHeaders = headers.filter(function (d) {
      return d.column instanceof LineUp.LineUpNumberColumn;
    });
    var barRows = allRows.selectAll('.tableData.bar')
      .data(function (d) {
        var data = allSingleBarHeaders.map(function (column) {
          return {
            key: column.getDataID(),
            value: column.getWidth(d),
            label: column.column.getRawValue(d),
            offsetX: column.offsetX
          };
        });
        return data;
      });
    var colPadding = config.svgLayout.columnPadding;
    var height = config.svgLayout.rowHeight - config.svgLayout.rowBarPadding*2;
    var style = {
      "position": "absolute",
      "left": function(d) { return d.offsetX + (colPadding / 2) + "px"; },
      "width": function(d) { return Math.max(+d.value - colPadding, 0) + "px"; },
      "height": height + "px",
      "margin-top": config.svgLayout.rowBarPadding + "px",
      "background-color": function(d) { return d3.rgb(config.colorMapping.get(d.key)); }
    };

    barRows.enter()
      .append('div')
      .attr({
        'class': 'tableData bar'
      })
      .style(style);
    barRows.exit().remove();

    barRows
      .style(style);
  }

  function updateStackBars(headers, allRows, _stackTransition, config, lineup) {
    // -- RENDER the stacked columns (update, exit, enter)
    var allStackedHeaders = headers.filter(function (d) {
      return (d instanceof LineUp.LayoutStackedColumn);
    });

    // -- render StackColumnGroups
    var stackRows = allRows.selectAll('.tableData.stacked')
      .data(function (d) {
        var dd = allStackedHeaders.map(function (column) {
          return {key: column.getDataID(), childs: column.children, parent: column, row: d};
        });
        return dd;
      });
    stackRows.exit().remove();
    stackRows.enter()
      .append('div')
      .attr('class', 'tableData stacked');

    stackRows
      .attr('style', function (d) {
        return "position:absolute;left:" + d.parent.offsetX + "px";
      });

    // -- render all Bars in the Group
    var allStackOffset = 0;
    var allStackW = 0;
    var allStackRes = {};

    var asStacked = showStacked(config, lineup);

    var allStack = stackRows.selectAll('div').data(function (d) {

        allStackOffset = 0;
        allStackW = 0;

        var mapped = d.childs.map(function (child, i) {
          allStackW = child.getWidth(d.row);

          allStackRes = {child: child, width: allStackW, offsetX: allStackOffset, last: i === d.childs.length - 1 };
          if (asStacked) {
            allStackOffset += allStackW;
          } else {
            allStackOffset += child.getColumnWidth();
          }
          return allStackRes;
        });

        var firstNE;
        var lastNE;
        mapped.forEach(function(m, i) {
          if (m.width >= 0.5) {
            lastNE = i;
            if (firstNE === undefined) {
              m.firstNonEmpty = true;
            }
          }
        });
        if (lastNE !== undefined) {
          mapped[lastNE].lastNonEmpty = true;
        }

        return mapped;
      }
    );

    var colPadding = config.svgLayout.columnPadding;
    var height = config.svgLayout.rowHeight - config.svgLayout.rowBarPadding*2 ;
    var barStyle = {
        "position": "absolute",
        "height": height + "px",
        "left": function(d) {
          var padding = 0;
          if (!asStacked || d.firstNonEmpty) {
            padding += (colPadding / 2);
          }
          return (d.offsetX + padding) + "px";
          // return d.offsetX + "px";
        },
        "width": function(d) {
            var widthAdjustment = (!asStacked || d.lastNonEmpty) ? -colPadding : 0;
            return Math.max(((d.width > 0) ? d.width + widthAdjustment : d.width), 0) + "px";
            // return Math.max(d.width, 0) + "px";
        },
        "background-color":  function (d) {
            return d3.rgb(config.colorMapping.get(d.child.getDataID()));
        }
    };

    allStack.exit().remove();
    allStack.enter().append('div')
        .style(barStyle);

    (_stackTransition ? allStack.transition(config.svgLayout.animationDuration) : allStack)
      .style(barStyle);
  }

  function createActions($elem, item, config) {
    var $r = $elem.selectAll('text').data(config.svgLayout.rowActions);
    $r.enter().append('text').append('title');
    $r.exit().remove();
    $r.attr('x', function (d, i) {
      return i * config.svgLayout.rowHeight;
    }).text(function (d) {
      return d.icon;
    }).on('click', function (d) {
      d.action.call(this, item.data, d);
    }).select('title').text(function (d) {
      return d.name;
    });
  }

  function updateActionBars(headers, allRows, config) {
    // -- handle the Single columns  (!! use unflattened headers for filtering)
    var allActionBarHeaders = headers.filter(function (d) {
      return (d instanceof LineUp.LayoutActionColumn);
    });
    var actionRows = allRows.selectAll('.tableData.action')
      .data(function (d) {
        var dd = allActionBarHeaders.map(function (column) {
          return {key: column.getDataID(), value: column.getColumnWidth(d),
            data: d,
            offsetX: column.offsetX};
        });
        return dd;
      });
    actionRows.enter()
      .append('g')
      .attr('class', 'tableData action')
      .each(function (item) {
        createActions(d3.select(this), item, config);
      });

    actionRows.exit().remove();

    actionRows
      .attr('transform', function (d) {
        return 'translate(' + (d.offsetX + 10) + ',' + (config.svgLayout.rowHeight * 0.5 + 1) + ')';
      });
  }

  function createRepr(col, row) {
    var r =col.getValue(row, 'raw');
    if (col instanceof LineUp.LayoutNumberColumn || col instanceof LineUp.LayoutStackedColumn) {
      r = (r === null || typeof r === 'undefined' ? 0 : isNaN(r) || r.toString() === '' ? '' : +r);
    }
    return r;
  }

  function generateTooltip(row, headers, config) {
    var $table = $('<div><table><thead><tr><th>Column</th><th>Value</th></tr></thead><tbody></tbody></table></div>');
    var $body = $table.find('tbody');
    headers.forEach(function (header) {
      var r = createRepr(header, row);
      if (typeof r === 'undefined') {
        r = '';
      } else if (typeof r === 'number') {
        r = config.numberformat(r);
      }
      $('<tr><th>' + header.getLabel() + '</th><td>' + r + '</td></tr>').appendTo($body);
    });
    return $table.html();
  }

/**
  * select one or more rows
  * @param row
 */
  LineUp.prototype.select = function(row) {
    var primaryKey = this.storage.primaryKey,
        $rows = this.$body.selectAll('.row');
    if (Array.isArray(row)) {
      this.storage.setSelection(row);
      row = row.map(function(d) { return d[primaryKey]; });
      $rows.classed('selected', function(d) { return row.indexOf(d[primaryKey]) >= 0; });
    } else if (row) {
      this.storage.setSelection([row]);
      $rows.classed('selected',function(d) { return d[primaryKey] === row[primaryKey]; });
    } else {
      this.storage.clearSelection();
      $rows.classed('selected',false);
    }
  };
  /**
   * updates the table body
   * @param headers - the headers as in {@link updateHeader}
   * @param data - the data array from {@link LineUpLocalStorage.prototype#getData()}
   */
  LineUp.prototype.updateBody = function (headers, data, stackTransition) {
    if (Array.isArray(headers) && headers.length === 0) {
      return;
    }
    //default values
    headers = headers || this.storage.getColumnLayout();
    data = data || this.storage.getData(headers[0].columnBundle);
    stackTransition = stackTransition || false;

    var svg = this.$body;
    var that = this;
    var primaryKey = this.storage.primaryKey;
    var zeroFormat = d3.format('.1f');
    var bundle = this.config.columnBundles[headers[0].columnBundle];
    //console.log('bupdate');
    stackTransition = stackTransition || false;

    var allHeaders = [];
    headers.forEach(function (d) {
      d.flattenMe(allHeaders);
    });

    var datLength = data.length, rawData = data;
    var rowScale = d3.scale.ordinal()
        .domain(data.map(function (d) {
          var value = d[primaryKey];

          return (value === null || typeof value === 'undefined') ? '' : value;
        }))
        .rangeBands([0, (datLength * (that.config.svgLayout.rowHeight + 2))], 0, 0),
      prevRowScale = bundle.prevRowScale || rowScale;
    //backup the rowscale from the previous call to have a previous 'old' position
    bundle.prevRowScale = rowScale;

    var headerShift = 0;
    if (that.config.svgLayout.mode === 'combined') {
      headerShift = that.config.htmlLayout.headerHeight;
    }

    this.$spacer
      .attr('style', 'position:absolute;top:0px;height:' + (datLength * that.config.svgLayout.rowHeight + headerShift) + "px")
      .html("&nbsp;");

    var visibleRange = this.selectVisible(data, rowScale);
    if (visibleRange[0] > 0 || visibleRange[1] < data.length) {
      data = data.slice(visibleRange[0], visibleRange[1]);
    }
    // -- handle all row groups

    var allRowsSuper = svg.selectAll('.row').data(data, function (d) {
      return d[primaryKey];
    });
    allRowsSuper.exit().remove();

    function rowStyler() {
      return [
        "height:" + that.config.svgLayout.rowHeight + "px",
        "margin-top:" + that.config.svgLayout.rowPadding + "px"
      ].join(";") + ";";
    }

    // --- append ---
    allRowsSuper.enter().append('div')
      .attr({
        style: function (d) { //init with its previous position
          var prev = prevRowScale(d[primaryKey]);
          if (typeof prev === 'undefined') { //if not defined from the bottom
            var range = rowScale.range();
            if (range && range.length > 0) {
              prev = range[range.length - 1];
            } else {
              prev = 0;
            }
          }
          return rowStyler(d) + 'transform:translate(0px, ' + Math.ceil(prev) + 'px)';//position:absolute;top:' + Math.ceil(prev) + "px";
        },
        'class': 'row'
      });

    //    //--- update ---
    (this.config.renderingOptions.animation ? allRowsSuper.transition().duration(this.config.svgLayout.animationDuration) : allRowsSuper).attr({
      style: function (d) { //init with its previous position
        var value = d[primaryKey];
        var prev = (value === null || typeof value === 'undefined' ? 0 : rowScale(value));
        return rowStyler(d) + 'transform:translate(0px, ' + Math.ceil(prev) + 'px)';//position:absolute;top:' + Math.ceil(prev) + "px";
      }
    });
    var asStacked = showStacked(this.config, this);

    function createOverlays(row) {
      var textOverlays = [];

      function toValue(v, col) {
        if (isNaN(v) || v === '' || typeof v === 'undefined') {
          return '';
        }
        return that.config.numberformat(+v, row, col);
      }

      headers.forEach(function (col) {
          if (col.column instanceof LineUp.LineUpNumberColumn) {
            textOverlays.push({id: col.id, value: col.getValue(row), label: that.config.numberformat(+col.getValue(row,'raw'), row, col),
              x: col.offsetX + 5,
              w: col.getColumnWidth()});
          } else if (col instanceof  LineUp.LayoutStackedColumn) {
            var allStackOffset = 0;

            col.children.forEach(function (child) {
              var allStackW = child.getWidth(row);

              textOverlays.push({
                  id: child.id,
                  label: toValue(child.getValue(row,'raw'), row, col) + ' -> (' + zeroFormat(child.getWidth(row)) + ')',
                  w: asStacked ? allStackW : child.getColumnWidth(),
                  x: (allStackOffset + col.offsetX)}
              );
              if (asStacked) {
                allStackOffset += allStackW;
              } else {
                allStackOffset += child.getColumnWidth();
              }
            });
          }
        }
      );
      return textOverlays;
    }

    function renderOverlays($row, textOverlays, clazz) {
      var overlays = $row.selectAll('div.' + clazz);
      function styler (d) {
        return [
          "left:" + d.x + "px",
          "width:" + Math.max(+d.w - 7, 0) + "px"
        ].join(";");
      }

      var tmp = overlays.data(textOverlays);
      tmp.enter().append('div').
        attr({
          'class': 'tableData ' + clazz,
          'style': styler
        }).text(function (d) {
          return d.label;
        });

      tmp.exit().remove();

      // update x on update
      overlays
        .attr('style', styler)
        .text(function(d) {
          return d.label;
        });
    }

    allRowsSuper.on({
      mouseenter: function (row) {
        var $row = d3.select(this);
        $row.classed('hover', true);
//            d3.select(this.parent).classed('hovered', true)
        var textOverlays = createOverlays(row);
        //create clip paths which clips the overlay text of the bars
        var shift = rowScale(row[primaryKey]);
        renderOverlays($row, textOverlays, 'hoveronly');

        function absoluteRowPos(elem) {
          return $(elem).offset().top;
        }
        if (that.config.interaction.tooltips) {
          that.tooltip.show(generateTooltip(row, allHeaders, that.config), {
            x: d3.mouse(that.$container.node())[0] + 10,
            y: absoluteRowPos(this),
            height: that.config.svgLayout.rowHeight
          });
        }
        that.hoverHistogramBin(row);
        that.listeners['hover'](row, shift);
      },
      mousemove: function () {
        if (that.config.interaction.tooltips) {
          that.tooltip.move({
            x: d3.mouse(that.$container.node())[0]
          });
        }
      },
      mouseleave: function () {
        if (that.config.interaction.tooltips) {
          that.tooltip.hide();
        }
        that.hoverHistogramBin(null);
        that.listeners['hover'](null);
        d3.select(this).classed('hover', false);
        d3.select(this).selectAll('.hoveronly').remove();
      },
      click: function (row) {
        var $row = d3.select(this),
            selected = that.storage.isSelected(row);
        if (that.config.interaction.multiselect(d3.event)) {
          var allselected = that.storage.selectedRows();
          if (selected) {
            $row.classed('selected', false);
            that.storage.deselect(row);
            if (allselected.length === 1) {
              //remove the last one
              that.listeners['selected'](null);
            }
            allselected.splice(allselected.indexOf(row), 1);
          } else {
            $row.classed('selected', true);
            that.storage.select(row);
            if (that.config.interaction.rangeselect(d3.event) && allselected.length === 1) {
              //select a range
              var i = rawData.indexOf(row), j = rawData.indexOf(allselected[0]);
              if (i < j) {
                allselected = rawData.slice(i, j + 1);
              } else {
                allselected = rawData.slice(j, i + 1);
              }
              var toSelect = allRowsSuper.filter(function (d) {
                return allselected.indexOf(d) >= 0;
              }).classed('selected', true).data();
              that.storage.selectAll(toSelect);
            } else {
              allselected.push(row);
            }
            if (allselected.length === 1) {
              //remove the last one
              that.listeners['selected'](row, null);
            }
          }
          that.listeners['multiselected'](allselected);
        } else {
          if (selected) {
            $row.classed('selected', false);
            that.storage.deselect(row);
            that.listeners['selected'](null);
            that.listeners['multiselected']([]);
          } else {
            var prev = allRowsSuper.filter('.selected').classed('selected', false);
            prev = prev.empty ? null : prev.datum();
            $row.classed('selected', true);
            that.storage.setSelection([row]);
            that.listeners['selected'](row, prev);
            that.listeners['multiselected']([row]);
          }
        }
      }
    });

    var allRows = allRowsSuper;

    updateSingleBars(headers, allRows, that.config);
    updateStackBars(headers, allRows, this.config.renderingOptions.animation && stackTransition, that.config, that);
    updateActionBars(headers, allRows, that.config);

    //Get and set the clip source to be used for rendering overlays. Scoping context to a related DOM element.
    updateText(allHeaders, allRows, that.config);
    updateCategorical(allHeaders, allRows, svg, that.config);
    if (that.config.renderingOptions.values) {
      allRowsSuper.classed('values', true);
      allRowsSuper.each(function (row) {
        var $row = d3.select(this);
        renderOverlays($row, createOverlays(row), 'valueonly');
      });
    } else {
      allRowsSuper.classed('values', false).selectAll('.valueonly').remove();
    }
    //update selections state
    allRowsSuper.classed('selected', function(d) {
      return that.storage.isSelected(d);
    });
  };
}(LineUp || (LineUp = {}), d3, jQuery));

/* global d3, jQuery */
var LineUp;
(function (LineUp, d3, $, undefined) {
  LineUp.prototype = LineUp.prototype || {};

  LineUp.prototype.layoutHeaders = function (headers) {
    var offset = 0;
    var config = this.config,
        headerHeight = config.htmlLayout.headerHeight,
        headerOffset = config.htmlLayout.headerOffset;

    headers.forEach(function (d) {
//        console.log(d);
      d.offsetX = offset;
      d.offsetY = headerOffset;
      d.height = headerHeight - headerOffset*2;
      offset += d.getColumnWidth();

//        console.log(d.getColumnWidth());
    });

    //console.log("layout Headers:", headers);

    //update all the plusSigns shifts
    var shift = offset + 4;
    d3.values(config.svgLayout.plusSigns).forEach(function (addSign) {
      addSign.x = shift;
      shift += addSign.w + 4;
    });

    headers.filter(function (d) {
      return (d instanceof LineUp.LayoutStackedColumn);
    })
      .forEach(function (d) {

        d.height = headerHeight / 2 - headerOffset*2;

        var localOffset = 0;
        var parentOffset = d.offsetX;
        var allChilds = d.children.concat(d.emptyColumns);
        allChilds.map(function (child) {
          child.offsetX = parentOffset + localOffset;
          child.localOffsetX = localOffset;
          localOffset += child.getColumnWidth();

          child.offsetY = headerHeight / 2 + headerOffset;
          child.height = headerHeight / 2 - headerOffset*2;
        });
      });
    this.totalWidth = shift;
  };

  /**
   * Render the given headers
   * @param headers - the array of headers, see {@link LineUpColumn}
   */
  LineUp.prototype.updateHeader = function (headers) {
    if (Array.isArray(headers) && headers.length === 0) {
      return;
    }
    headers = headers || this.storage.getColumnLayout();
//    console.log('update Header');
    var rootHeader = this.$header;
    var svg = rootHeader.select('.main');

    var that = this;
    var config = this.config;

    if (this.headerUpdateRequired) {
      this.layoutHeaders(headers);
      this.$bodySVG.style({ 'width': this.totalWidth + "px" });
      this.headerUpdateRequired = false;
    }

    var allHeaderData = [];
    headers.forEach(function (d) {
      d.flattenMe(allHeaderData, {addEmptyColumns: true});
    });
    //reverse order to render from right to left
    allHeaderData.reverse();

    function isSortedColumn(sc, d) {
      if (sc === d) {
        return true;
      }
      return sc && d && sc.column && d.column && sc.column.column === d.column.column;
    }

    // -- Handle the header groups (exit,enter, update)

    var allHeaders = svg.selectAll('.header').data(allHeaderData, function (d) {
      return d.id;
    });
    allHeaders.exit().remove();

    // --- adding Element to class allHeaders
    var allHeadersEnter = allHeaders.enter().append('div').attr('class', 'header')
      .classed('emptyHeader', function (d) {
        return d instanceof LineUp.LayoutEmptyColumn || d instanceof LineUp.LayoutActionColumn;
      })
      .classed('nestedHeader', function (d) {
          return d && d.parent instanceof LineUp.LayoutStackedColumn;
      })
      .call(function () {
        that.addResortDragging(this, config);
      });

    var handleWidth = config.htmlLayout.handleWidth;
    // --- changing nodes for allHeaders
    allHeaders.style({
      position: "absolute",
      "left": function(d) { return d.offsetX + 'px'; },
      "top": function(d) { return d.offsetY + 'px'; },
      // "z-index": 1,
      width: function (d) {
        // Uncharted (Dario): Added safety check to avoid negative values.
        // Empty columns are as wide as their parent
        if (d instanceof LineUp.LayoutEmptyColumn) {
            d = d.parent;
        }
        return Math.max(d.getColumnWidth() - (handleWidth / 2), 0) + "px";
      },
      height: function (d) {
        return d.height + "px";
      }
    }).style('background-color', function (d) {
      if (d instanceof LineUp.LayoutEmptyColumn) {
        return 'lightgray';
      } else if (d.column && config.colorMapping.has(d.column.id)) {
        return config.colorMapping.get(d.column.id);
      } else {
        return config.grayColor;
      }
    })
      .on('click', function (d) {
        // Uncharted (Dario): Removed click functionality from LayoutRankColumn instances
        if (d3.event.defaultPrevented ||
            d instanceof LineUp.LayoutEmptyColumn ||
            d instanceof LineUp.LayoutActionColumn ||
            d instanceof LineUp.LayoutRankColumn ||
            (d.column && d.column.config && d.column.config.sortable === false)) {
          return;
        }
        // no sorting for empty stacked columns !!!
        if (d instanceof LineUp.LayoutStackedColumn && d.children.length < 1) {
          return;
        }

        var bundle = config.columnBundles[d.columnBundle];
        // TODO: adapt to comparison mode !!
        //same sorting swap order
        if (bundle.sortedColumn !== null && isSortedColumn(bundle.sortedColumn, d)) {
          bundle.sortingOrderAsc = !bundle.sortingOrderAsc;
        } else {
          bundle.sortingOrderAsc = d instanceof LineUp.LayoutStringColumn || d instanceof LineUp.LayoutCategoricalColumn || d instanceof LineUp.LayoutRankColumn;
        }

        bundle.sortedColumn = d;
        that.listeners['change-sortcriteria'](this, d, bundle.sortingOrderAsc);
        if (!that.config.sorting || !that.config.sorting.external) {
          that.storage.resortData({column: d, asc: bundle.sortingOrderAsc});
        }
        that.updateAll(false);
      });

    allHeadersEnter.append('div').attr('class', 'hist');
    var allNumberHeaders = allHeaders.filter(function (d) {
      return d instanceof LineUp.LayoutNumberColumn;
    });
    if (this.config.renderingOptions.histograms) {
      allNumberHeaders.selectAll('div.hist').each(function (d) {
        var $this = d3.select(this);
        d.getHist(function(h) {
          if (!h) {
            return;
          }
          var s = d.value2pixel.copy().range([0, d.value2pixel.range()[1]-5]);
          var $hist = $this.selectAll('div').data(h);
          $hist.enter().append('div').attr({ "class": "hist-bar" });
          $hist.style({
            position: "absolute",
            left : function(bin) {
              return s(bin.x) + "px";
            },
            width: function(bin) {
              return Math.max(s(bin.dx), 0) + "px";
            },
            // top: function(bin) {
            //   return (1-bin.y) + "px";
            // },
            bottom: "0px",
            height: function(bin) {
              return (Math.max(bin.y, 0) * d.height) + "px";
            }
          });
        });
      });
    } else {
      allNumberHeaders.selectAll('div.hist').selectAll('*').remove();
    }

    // -- handle WeightHandle

    if (this.config.manipulative) {
      allHeadersEnter.filter(function (d) {
        return !(d instanceof LineUp.LayoutEmptyColumn) && !(d instanceof LineUp.LayoutActionColumn);
      }).append('div').attr({
        'class': 'weightHandle'
      }).style({
        position: "absolute",
        "z-index": 2,
        left: function (d) {
          // Uncharted (Dario): Added safety check to avoid negative values.
          return Math.max(d.getColumnWidth() - (handleWidth / 2), 0) + "px";
        },
        top: "0px",
        width: handleWidth + "px"
      });

      allHeaders.select('.weightHandle').style({
        "box-sizing": "border-box",
        border: "1px solid #bbb",
        "background-color": "lightgray",
        left: function (d) {
          // Uncharted (Dario): Added safety check to avoid negative values.
          return Math.max(d.getColumnWidth() - (handleWidth / 2), 0) + "px";
        },
        height: function (d) {
          return d.height + "px";
        }
      }).call(this.dragWeight); // TODO: adopt dragWeight function !
    }

    // -- handle Text
    allHeadersEnter.append('div').attr({
      'class': 'headerLabel'
    }).style({
      "overflow": "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
      "margin-left": (config.htmlLayout.labelLeftPadding  + (handleWidth / 2)) +  "px"
    });

    //Get and set the clip source to be used for rendering overlays. Scoping context to a related DOM element.
    // var clipSource = that.getClipSource.apply(this.$container[0][0]);

    allHeaders.select('.headerLabel')
      .classed('sortedColumn', function (d) {
        var sc = config.columnBundles[d.columnBundle].sortedColumn;
        return isSortedColumn(sc, d);
      })
      .style({
        "margin-top": function (d) {
          if (d instanceof LineUp.LayoutStackedColumn || d.parent != null) {
            return "calc(" + (d.height * 0.5) + "px - .5em)";
          }
          return "calc(" + (d.height * 0.75) + "px - .5em)";
        }
      }).text(function (d) {
        return d.getLabel();
      });

    // -- handle the Sort Indicator
    allHeadersEnter.append('div').attr({
      'class': 'headerSort'
    }).style({
      position: "absolute",
      top: function (d) {
        return "calc(" + (d.height / 2) + "px - .5em)";
      },
      left: (handleWidth / 2) + "px"
    });

    allHeaders.select('.headerSort').text(function (d) {
      var sc = config.columnBundles[d.columnBundle].sortedColumn;
      return ((isSortedColumn(sc, d)) ?
        ((config.columnBundles[d.columnBundle].sortingOrderAsc) ? '\uf0de' : '\uf0dd')
        : '');
    })
      .style({
        top: function (d) {
          return "calc(" + (d.height / 2) + "px - .5em)";
        }
      });


    // add info Button to All Stacked Columns
    if (this.config.manipulative) {
      var buttons = [
        {
          'class': 'stackedColumnInfo',
          text: '\uf1de',
          filter: function (d) {
            return d instanceof LineUp.LayoutStackedColumn ? [d] : [];
          },
          action: function (d) {
            that.stackedColumnOptionsGui(d);
          }
        },
        {
          'class': 'singleColumnDelete',
          text: '\uf014',
          filter: function (d) {
            var isInvalidColumn =
              d instanceof LineUp.LayoutRankColumn ||
              d instanceof LineUp.LayoutStackedColumn ||
              d instanceof LineUp.LayoutEmptyColumn ||
              d instanceof LineUp.LayoutActionColumn ||
              (d.column && d.column.config && d.column.config.removable === false);
            return /* ATS: Added this one */ isInvalidColumn ? [] : [d];
          },
          action: function (d) {
            that.storage.removeColumn(d);
            that.listeners['columns-changed'](that);
            that.headerUpdateRequired = true;
            that.updateAll();
          }
        },
        {
          'class': 'singleColumnFilter',
          text: '\uf0b0',
          filter: function (d) {

            return (d.column && d.column.config && d.column.config.filterable !== false) ? [d] : [];
          },
          offset: config.htmlLayout.buttonWidth,
          action: function (d) {
            if (d instanceof LineUp.LayoutStringColumn) {
              that.openFilterPopup(d, d3.select(this));
            } else if (d instanceof LineUp.LayoutCategoricalColumn) {
              that.openCategoricalFilterPopup(d, d3.select(this));
            } else if (d instanceof LineUp.LayoutNumberColumn) {
              that.openMappingEditor(d, d3.select(this));
            }
          }
        }
      ];

      buttons.forEach(function (button) {
        var $button = allHeaders.selectAll('.' + button.class).data(button.filter);
        $button.exit().remove();
        $button.enter().append('div')
          .attr('class', function(d) {
            return 'fontawe ' + button.class + (d.isFiltered() ? ' filtered': '');
          })
          .text(button.text)
          .on('click', function() {
            var args = Array.prototype.slice.call(arguments, 0);
            button.action.apply(this, args);
            d3.event.preventDefault();
            d3.event.stopPropagation();
          });
        $button
        .attr({
          'class': function(d) {
            return 'fontawe ' + button.class + (d.isFiltered() ? ' filtered': '');
          }
        })
        .style({
          left: function (d) {
            return (d.getColumnWidth() - config.htmlLayout.buttonRightPadding - (button.offset || 0) - (handleWidth / 2)) + "px";
          },
          "position": "absolute",
          top: config.htmlLayout.buttonTopPadding + "px"
        });
      });
    }

    // ==================
    // -- Render add ons
    //===================


    // add column signs:
    var plusButton = d3.values(config.svgLayout.plusSigns);
    var addColumnButton = svg.selectAll('.addColumnButton').data(plusButton);
    addColumnButton.exit().remove();


    var addColumnButtonEnter = addColumnButton.enter().append('g').attr({
      class: 'addColumnButton'
    });

    addColumnButton.attr({
      'transform': function (d) {
        return 'translate(' + d.x + ',' + d.y + ')';
      }
    });

    addColumnButtonEnter.append("title").text(function(d) { return d.title; });

    addColumnButtonEnter
    .filter(function(d) { return !d.render; })
    .append('rect').attr({
      x: 0,
      y: 0,
      rx: 5,
      ry: 5,
      width: function (d) {
        return d.w;
      },
      height: function (d) {
        return d.h;
      }
    })
    .on('click', function (d) {
      if ($.isFunction(d.action)) {
        d.action.call(that, d);
      } else {
        that[d.action](d);
      }
    });

     addColumnButtonEnter
    .filter(function(d) { return !d.render; })
    .append('text').attr({
      x: function (d) {
        return d.w / 2;
      },
      y: function (d) {
        return d.h / 2;
      }
    })
    .text(function(d) {
      return d.text || '\uf067';
    });

    addColumnButtonEnter
      .filter(function(d) { return !!d.render; })
      .append(function(d) {
        return d.render.call(that, d);
      })
      .on('click', function (d) {
        if ($.isFunction(d.action)) {
          d.action.call(that, d);
        } else {
          that[d.action](d);
        }
      });
  };

  LineUp.prototype.hoverHistogramBin = function (row) {
    if (!this.config.renderingOptions.histograms) {
      return;
    }
    var $hists = this.$header.selectAll('div.hist');
    $hists.selectAll('.hist-bar').classed('hover',false);
    if (row) {
      this.$header.selectAll('div.hist').each(function(d) {
          if (d instanceof LineUp.LayoutNumberColumn) {
            var that = this;
            d.getHist(function (hist) {
              if (hist) {
                d.binOf(row, function(bin) {
                  if (bin >= 0) {
                    d3.select(that).select('.hist-bar:nth-child('+(bin+1)+')').classed('hover',true);
                  }
                });
              }
          });
        }
      });
    }
  };
// ===============
// Helperfunctions
// ===============


  LineUp.prototype.addResortDragging = function (xss) {
    if (!this.config.manipulative) {
      return;
    }

    var x = d3.behavior.drag(),
      that = this,
      rootHeader = this.$header,
      overlay = rootHeader.select('div.overlay'),
      hitted = null,
      moved = false;
    x.call(xss);

    function dragstart(d) {
      if (d instanceof LineUp.LayoutEmptyColumn) {
        return;
      }

      d3.event.sourceEvent.stopPropagation(); // silence other listeners

      d3.select(this).classed('dragObject', true);

      hitted = null;
      moved = false;
    }

    function dragmove(d) {
      if (d instanceof LineUp.LayoutEmptyColumn) {
        return;
      }

      moved = true;
      var dragHeader = overlay.selectAll('.dragHeader').data([d]);
      var dragHeaderEnter = dragHeader.enter().append('div')
        .attr({
          class: 'dragHeader'
        })
        .style({
          "background-color": "black",
          "position": "absolute",
          width: function (d) {
            // Empty columns are as wide as their parent
            if (d instanceof LineUp.LayoutEmptyColumn) {
                d = d.parent;
            }
            return d.getColumnWidth() + "px";
          },
          height: function (d) {
            return d.height + "px";
          }
        });

      dragHeaderEnter.append('div');


      var mouse = d3.mouse(rootHeader.node());
      var x = mouse[0] || 0;
      var y = mouse[1] || 0;
      dragHeader.style({
        left: (x + 3) + 'px',
        top:  (y - 10) + 'px'
      });

      var allHeaderData = [];
      that.storage.getColumnLayout().forEach(function (d) {
        d.flattenMe(allHeaderData, {addEmptyColumns: true});
      });

      function contains(header, x, y) {
        //TODO check if types match
        if (x > header.offsetX && (x - header.offsetX) < header.getColumnWidth()) {
          if (y > header.offsetY && (y - header.offsetY) < header.height) {
            if ((x - header.offsetX < header.getColumnWidth() / 2)) {
              return {column: header, insert: 'l', tickX: (header.offsetX), tickY: (header.offsetY), tickH: header.height};
            } else {
              return {column: header, insert: 'r', tickX: (header.offsetX + header.getColumnWidth()), tickY: (header.offsetY), tickH: header.height};
            }
          }
        }

        return null;
      }

      var it = 0;
      hitted = null;
      while (it < allHeaderData.length && hitted == null) {
        hitted = contains(allHeaderData[it], x, y);
        it++;
      }

//        console.log(hitted);

      var columnTick = overlay.selectAll('.columnTick').data(hitted ? [hitted] : []);
      columnTick.exit().remove();
      columnTick.enter().append('div').attr({
        class: 'columnTick'
      }).style({
        position: "absolute",
        width: "10px",
        "background-color": "black"
      });

      columnTick.style({
        left: function (d) {
          return (d.tickX - 5) + "px";
        },
        top: function (d) {
          return d.tickY + "px";
        },
        height: function (d) {
          return d.tickH + "px";
        }
      });
    }


    function dragend(d) {
      if (d3.event.defaultPrevented || d instanceof LineUp.LayoutEmptyColumn) {
        return;
      }

      d3.select(this).classed('dragObject', false);
      overlay.selectAll('.dragHeader').remove();
      overlay.selectAll('.columnTick').remove();

      if (hitted && hitted.column === this.__data__) {
        return;
      }

      if (hitted) {
//            console.log('EVENT: ', d3.event);
        if (d3.event.sourceEvent.altKey) {
          that.storage.copyColumn(this.__data__, hitted.column, hitted.insert);
        } else {
          that.storage.moveColumn(this.__data__, hitted.column, hitted.insert);
        }

        that.listeners['columns-changed'](that);
//            that.layoutHeaders(that.storage.getColumnLayout());
        that.headerUpdateRequired = true;
        that.updateAll();

      }

      if (hitted == null && moved) {
        that.headerUpdateRequired = true;
        that.storage.removeColumn(this.__data__);

        that.listeners['columns-changed'](that);

        that.updateAll();
      }
    }


    x.on('dragstart', dragstart)
      .on('drag', dragmove)
      .on('dragend', dragend);
  };


  LineUp.prototype.addNewEmptyStackedColumn = function () {
    this.storage.addStackedColumn(null, -1);
    this.headerUpdateRequired = true;

    this.listeners['columns-changed'](this);

    this.updateAll();
  };

  LineUp.prototype.clearSelection = function () {
    this.select();
  };

  /**
   * Called to retrieve the relevant clip source. If Lineup is loaded inside an iFrame
   * directly (without a src), we will need to check if the documentURI is different
   * than the baseURI. If its different we should use absolute IRI references instead
   * of relative IRI references. This is needed to support lineup view in PowerBI for Firefox v45.
   */
  LineUp.prototype.getClipSource = function() {
    if (this.ownerDocument &&
        this.ownerDocument.documentURI !== this.ownerDocument.baseURI) {
      return this.ownerDocument.documentURI;
    }
    return '';
  };

  /**
   * called when a Header width changed, calls {@link updateHeader}
   * @param change - the change information
   * @param change.column - the changed column, see {@link LineUpColumn}
   * @param change.value - the new column width
   */
  LineUp.prototype.reweightHeader = function (change) {
//    console.log(change);
    change.column.setColumnWidth(change.value);
    this.headerUpdateRequired = true;
    this.updateAll();
  };
}(LineUp || (LineUp = {}), d3, jQuery));

return LineUp;
  }
  if (typeof define === "function" && define.amd) {
    define(['jquery','d3','underscore'], LineUpLoader);
  } else if (typeof module === "object" && module.exports) {
    module.exports = LineUpLoader(require('jquery'), require('d3'), require('underscore'));
  } else {
    this.LineUp = LineUpLoader(jQuery, d3, _);
  }
}.call(this));
