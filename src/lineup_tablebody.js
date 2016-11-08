/**
 * Created by Hendrik Strobelt (hendrik.strobelt.com) on 8/15/14.
 */
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

        return d.childs.map(function (child, i) {
          allStackW = child.getWidth(d.row);

          allStackRes = {child: child, width: allStackW, offsetX: allStackOffset, last: i === d.childs.length - 1 };
          if (asStacked) {
            allStackOffset += allStackW;
          } else {
            allStackOffset += child.getColumnWidth();
          }
          return allStackRes;
        });
      }
    );

    var colPadding = config.svgLayout.columnPadding;
    var height = config.svgLayout.rowHeight - config.svgLayout.rowBarPadding*2 ;
    var barStyle = {
        "position": "absolute",
        "height": height + "px",
        "left": function(d) {
          var padding = 0;
          if (!asStacked) {
            padding += (colPadding / 2);
          }
          return (d.offsetX + padding) + "px";
        },
        "width": function(d) {
            var widthAdjustment =
              !asStacked || d.last ? -colPadding : 1;
            return Math.max(((d.width > 0) ? d.width + widthAdjustment : d.width), 0) + "px";
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
