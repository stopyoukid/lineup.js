/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 8/15/14.
 */
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
        if (d3.event.defaultPrevented || d instanceof LineUp.LayoutEmptyColumn || d instanceof LineUp.LayoutActionColumn || d instanceof LineUp.LayoutRankColumn) {
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
            return (/* ATS: Added this one */d instanceof LineUp.LayoutRankColumn || d instanceof LineUp.LayoutStackedColumn || d instanceof LineUp.LayoutEmptyColumn || d instanceof LineUp.LayoutActionColumn) ? [] : [d];
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
            return (d.column) ? [d] : [];
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
