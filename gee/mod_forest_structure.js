exports.doc_forest_structure= 'Various functions to characterize forest structure.' +
    '\n' +
    '\n get_abruptness(image):' +
    '\n   @param {ee.Image} An image representing a forest structure variable' +
    '\n   @return {ee.Image} A new band added to the input image representing the spatial rate of change of the forest structure variable.' +
    '\n';
    
exports.dem_masking = function(dem, MAP_LC_MASK) {
  
  // Prep for masking for DEM
  // from WorldCover
  var worldcover = ee.Image(ee.ImageCollection("ESA/WorldCover/v100").first())
                    .reproject(dem.projection(), null)
  var water = worldcover.updateMask(worldcover.eq(80)); 
  var wetland_herb = worldcover.updateMask(worldcover.eq(90)); 
  var barren = worldcover.updateMask(worldcover.eq(60)); 
  var built = worldcover.updateMask(worldcover.eq(50)); 
  var moss_lichen = worldcover.updateMask(worldcover.eq(100))
  
  // From Global Surface Water
  var watersurface = ee.Image("JRC/GSW1_3/GlobalSurfaceWater");
  var water_occurrence = watersurface.select('occurrence');
  
  if(MAP_LC_MASK){
    Map.addLayer(water, {palette: "#0064c8"}, "ESA Water")
    Map.addLayer(wetland_herb, {palette: "#0096a0"}, "ESA wetland")
    Map.addLayer(barren, {palette: "brown"}, "ESA barren")
    Map.addLayer(built, {palette: "red"}, "ESA built")
    Map.addLayer(moss_lichen, {palette: "#fae6a0"}, "ESA moss/lichen")
  }
  // This handles masking out of areas where you DONT want to grow trees (becomes NoData in output DEM)
  //
  // Set TCC Mask: [1] pixel values
  var worldcover_water_mask = worldcover.mask(worldcover.neq(80)); 
  var worldcover_wetland_mask = worldcover.mask(worldcover.neq(90)); 
  var worldcover_barren_mask = worldcover.mask(worldcover.neq(60)); 
  var worldcover_built_mask = worldcover.mask(worldcover.neq(50));
  var worldcover_mosslichen_mask = worldcover.mask(worldcover.neq(100))
  // Why is this so hard to get right???
  //var water_occurrence_mask = water_occurrence.mask(water_occurrence.gt(0));
  //var water_occurrence_mask = water_occurrence.selfMask();
  //var water_occurrence_mask = water_occurrence.gt(0).selfMask();
  
  // Apply all the masks to the DEM
  dem = dem.updateMask(worldcover_water_mask)
            .updateMask(worldcover_barren_mask)
            .updateMask(worldcover_wetland_mask)
            .updateMask(worldcover_built_mask)
            //.updateMask(worldcover_mosslichen_mask)
            //.updateMask(water_occurrence_mask)
            
  return dem
}

exports.removeProperty = function(feat, property) {
  // Generic Function to remove a property from a feature
  //https://gis.stackexchange.com/questions/321724/removing-property-from-feature-or-featurecollection-using-google-earth-engine
  var properties = feat.propertyNames()
  var selectProperties = properties.filter(ee.Filter.neq('item', property))
  return feat.select(selectProperties)
}

exports.paint_boundaries = function(fc, desc, color, linewidth){
  // Paint feature edges to the empty image.
  var boundaries = ee.Image().byte()
  .paint({featureCollection: fc, color: 1, width: linewidth})
  // Convert to an RGB visualization image; set line color to black.
  .visualize({palette: color});
Map.addLayer(boundaries, {}, desc);
};

exports.add_lat_lon_fields = function(f) {
    // Get centroid components
      return f.set('cent_lat', f.centroid().geometry().coordinates().get(1))
              .set('cent_lon', f.centroid().geometry().coordinates().get(0));
};

exports.export_boreal_data = function(input_image, res, output_name, xmin, ymin, xmax, ymax){
  /////////////////////////////////////////////
  // Function to standardize the export of Boreal Data
  var xmin_360 = 180 + xmin;
  var asset_extent = ee.Geometry.Rectangle([xmin, ymin, xmax, ymax], 'EPSG:4326', false);
  //Map.addLayer(asset_extent, {}, 'asset_extent');
  Export.image.toDrive({
    image: input_image.clip(asset_extent), 
    description: output_name ,//+"_"+ymax+"_"+xmin_360, 
    //assetId: output_name ,//+"_"+ymax+"_"+xmin_360,
    //pyramidingPolicy:  {".default": "mode"},
    scale: res,
    region: asset_extent,
    maxPixels:1e13
  });
};

exports.get_sum = function(image, kern_size) {  // Compute sum of pixels in kernel of given kern_size
  return image.reduceNeighborhood({
    reducer: ee.Reducer.sum(),
    kernel: ee.Kernel.square(kern_size)
    });
};

exports.get_abruptness = function(image) {
  // Function to calc abruptness (i.e., normalized spatial rate of change) of an image
  var spat_rate_of_change = ee.Terrain.slope(image);
  
  image = image.addBands(spat_rate_of_change).rename('tcc','tcc_spat_rate_chg-old');   // REMOVE THIS SOON
  // Scale the spat_rate_of_change values in degrees (0-90) to range equal to that of TCC (0-100)
  // 100 * [(spat_rate_of_change - min(spat_rate_of_change))  / ( max(spat_rate_of_change) - min(spat_rate_of_change))]
  // min(spat_rate_of_change) = 0
  spat_rate_of_change = spat_rate_of_change.divide(90).multiply(100)
  image = image.addBands(spat_rate_of_change).rename('tcc','tcc_spat_rate_chg-old','tcc_spat_rate_chg');   // CHANGE THIS SOON
  
  // Compute abruptness using form:  (spat_rate_sum - image_sum) / (spat_rate_sum + image_sum)
  image = image.addBands(image.normalizedDifference(['tcc_spat_rate_chg', 'tcc']).rename('tcc_abruptness'));
  image = image.addBands(image.normalizedDifference(['tcc_spat_rate_chg-old', 'tcc']).rename('tcc_abruptness-old')); // REMOVE THIS SOON
  return image;
};

exports.make_hs = function(image) {
  // Use an elevation dataset and terrain functions to create
// a custom visualization of topography.

// Use the terrain algorithms to compute a hillshade with 8-bit values.
var shade = ee.Terrain.hillshade(image);
Map.addLayer(shade, {}, 'hillshade', true);

// Create a "sea" variable to be used for cartographic purposes
var sea = image.lte(0);
Map.addLayer(sea.mask(sea), {palette:'000022'}, 'sea', true);
}

exports.makeMapGrey = function() {
  var GRAY = [
  {   // Dial down the map saturation.
    stylers: [ { saturation: -100 } ]
  },{ // Dial down the label darkness.
    elementType: 'labels',
    stylers: [ { lightness: 20 } ]
  },{ // Simplify the road geometries.
    featureType: 'road',
    elementType: 'geometry',
    stylers: [ { visibility: 'simplified' } ]
  },{ // Turn off road labels.
    featureType: 'road',
    elementType: 'labels',
    stylers: [ { visibility: 'off' } ]
  },{ // Turn off all icons.
    elementType: 'labels.icon',
    stylers: [ { visibility: 'off' } ]
  },{ // Turn off all POIs.
    featureType: 'poi',
    elementType: 'all',
    stylers: [ { visibility: 'off' }]
  }];
  Map.setOptions('Gray', {'Gray': GRAY});
}

exports.makeLegend = function(vis, description) {
  ////////////////////////////////////////////////////////////////////////////////////
// Legend: A function to construct a legend for the given single-band vis
// parameters.  Requires that the vis parameters specify 'min' and 
// 'max' but not 'bands'.
  var lon = ee.Image.pixelLonLat().select('longitude');
  var gradient = lon.multiply((vis.max-vis.min)/100.0).add(vis.min);
  var legendImage = gradient.visualize(vis);
  
  // In case you really need it, get the color ramp as an image:
  //print(legendImage.getThumbURL({bbox:'0,0,100,8', dimensions:'256X20'}));
  
  // Otherwise, add it to a panel and add the panel to the map.
  var thumb = ui.Thumbnail({
    image: legendImage, 
    params: {bbox:'0,0,100,8', dimensions:'256X20'}, 
    style: {padding: '1px', position: 'bottom-center'}
  });
  var panel = ui.Panel({
    widgets: [
      ui.Label(vis.min),
      ui.Label(description),
      ui.Label({style: {stretch: 'horizontal'}}), 
      ui.Label(vis.max)
    ],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {stretch: 'horizontal'}
  });
  return ui.Panel().add(panel).add(thumb);
};

exports.add_legend = function(title, lbl, pal) {
  var legend = ui.Panel({style: {position: 'bottom-left'}}), entry;
  legend.add(ui.Label({value: title, style: { fontWeight: 'bold', fontSize: '10px', margin: '0 0 4px 0', padding: '10px' } }));
  for (var x = 0; x < lbl.length; x++){
    entry = [ ui.Label({style:{color: pal[x], margin: '0 0 4px 0'}, value: '██'}),
      ui.Label({ value: lbl[x], style: { margin: '0 0 4px 4px' } }) ];
    legend.add(ui.Panel(entry, ui.Panel.Layout.Flow('horizontal')))
  }
  Map.add(legend);
}

exports.return_legend = function(title, lbl, pal) {
  var legend = ui.Panel({style: {position: 'bottom-left'}}), entry;
  legend.add(ui.Label({value: title, style: { fontWeight: 'bold', fontSize: '10px', margin: '0 0 4px 0', padding: '0px' } }));
  for (var x = 0; x < lbl.length; x++){
    entry = [ ui.Label({style:{color: pal[x], margin: '0 0 4px 0'}, value: '██'}),
      ui.Label({ value: lbl[x], style: { margin: '0 0 4px 4px' } }) ];
    legend.add(ui.Panel(entry, ui.Panel.Layout.Flow('horizontal')))
  }
  return legend;
}

exports.get_opts_histo = function(histo_title, hAxis_title, ticks_list){
  //-------------HISTOGRAM OPTIONS
  // Pre-define some customization options.

  var opts_histo = {
        title: histo_title,
        fontSize: 14,
        bar: { gap: 0 },
        hAxis: {title: hAxis_title,
            ticks: ticks_list},   //TTE_Classes --> [1,2,3,4,5,6,7]  Abruptness --> [-0.75, -0.25, 0, 0.25, 0.75]
        vAxis: {title: 'count'},
        series: {
    //0: {color: 'red'},
    1: {color: '5255a3'},
    2: {color: '1796a3'},
    3: {color: '2AFF0fdbf6f0'},
    4: {color: 'ff7f00'},
    5: {color: '#ffffbf'},
    6: {color: '#d9ef8b'},
    7: {color: '#91cf60'},
    8: {color: '#1a9850'},
    9: {color: 'black'},
    10: {color: 'red'},
    11: {color: 'blue'}},
            chartArea: { width: 401 },
  };
  return opts_histo;
};

exports.get_region_mean = function(image, featureCol) {
  ///////////////////////////////////////////////////////
  // Zonal Stats Function: Collect region, image, value triplets.
    return image.reduceRegions({
                        collection: featureCol, 
                        reducer: ee.Reducer.mean(),
                        scale: image.projection().nominalScale() //2
                        })
    .filter(ee.Filter.neq('mean', null))
    .map(function(f) {
        return f.set('image_id', image.id());
        });
};//end func

exports.do_reduceRes = function(image, maxPix, prj){
  // Force the next reprojection to aggregate instead of resampling.
  //https://developers.google.com/earth-engine/resample
    return image.reduceResolution({
      reducer: ee.Reducer.mean(),
      maxPixels: maxPix
    })
    .multiply(ee.Image.pixelArea())
    .reproject({
      crs: prj
    });
};

exports.create_grid = function(lon_start, lon_end, lat_start, lat_end, num_cells) {
//********************************; CREATE GRIDS ;*************************************
/* Create Grids
  MAKE GRID FOR "REGIONAL" SST (3 STEPS)
  
*/
// 1) Create bounding box (here, centered just left of Hawaii)
/*      var lon_start = -170;
      var lon_end = -50;
      var lat_start = 50; 
      var lat_end = 70;*/
// 2) Decide no. of (in this case: equally sized) cells
      //var num_cells = 500; // CHANGE THE NUM_CELLS AS YOU LIKE
      var lon_edge = (lon_end-lon_start)/Math.sqrt(num_cells);
      var lat_edge = (lat_end-lat_start)/Math.sqrt(num_cells);
// 3) Create the grid
      var polys = [];
      var polys_line = [];
      var cell_id = 0;
      for (var lon = lon_start; lon < lon_end; lon += lon_edge) {
        var x1 = lon;
        var x2 = lon + lon_edge;
        for (var lat = lat_start; lat < lat_end; lat += lat_edge) {
          cell_id = cell_id + 1;
          var y1 = lat;
          var y2 = lat + lat_edge;
      
          polys.push(ee.Feature(ee.Geometry.Rectangle(x1, y1, x2, y2), {label: cell_id}));
        }
      }
      //var grid = ee.FeatureCollection(polys);
      return ee.FeatureCollection(polys);
/*print(grid.first(),'First')  
var grid_img = ee.Image().byte().paint(grid, 'label');
Map.addLayer(grid_img.randomVisualizer(), {}, 'grid label')*/
//Map.addLayer(grid, {}, 'grid')
};

exports.do_intersect = function(grid, polygon_fc) {
// 
//********************************; JOIN GRIDS ;*************************************
/* Join grids and reference polygon and select only intersecting polygons
   INTERSECT POLYGONS
   Define a spatial filter as geometries that intersect.
*/
      var spatialFilter = ee.Filter.intersects({
        leftField: '.geo',
        rightField: '.geo',
        maxError: 1000
      });
      
      // Define a save all join.
      var saveAllJoin = ee.Join.saveAll({
        matchesKey: 'pxlval'//'ECO_NAME',//'pxlval',
      });
      
      // Apply the join.
      var intersectJoined = saveAllJoin.apply(grid, polygon_fc, spatialFilter);
      //print(intersectJoined,'Intersect');
      // var test = ee.List(intersectJoined.first().get('pxlval'));
      // print(test)
//     
//****************; ITERATE & CREATE FEATURE COLLECTION ;****************************
/* Join grids and reference polygon and select only intersecting polygons
   INTERSECT POLYGONS
   Define a spatial filter as geometries that intersect.
*/
      var empty = ee.List([ee.Feature(null)]);
      // print(empty)
      // print(ee.List([ee.Feature(null)])) 
      var accumulate = function(feature, list) {
          var new_collect = ee.List(feature.get('pxlval'));
          return ee.List(list).add(new_collect).flatten();
        };
      // var cumulative = ee.List(intersectJoined.limit(1).iterate(accumulate, empty));
      var cumulative = ee.List(intersectJoined.iterate(accumulate, empty));
      //cumulative = ee.FeatureCollection(cumulative.slice(1,cumulative.size()));
      return ee.FeatureCollection(cumulative.slice(1,cumulative.size()));
/* End of routines */
};

exports.get_region_sum = function(img, fc) {
  return img.reduceRegions({
          collection: fc,
          reducer: ee.Reducer.sum(),
          scale: img.projection().nominalScale(),
          tileScale: 16
          });
};

exports.get_region_pearsons = function(img, fc) {
  return img.reduceRegions({
          collection: fc,
          reducer: ee.Reducer.pearsonsCorrelation(),
          scale: img.select('tpi').projection().nominalScale(),
          tileScale: 16
          });
};

exports.do_scat = function(image, band_y1, band_x, region, title) {

// Get a dictionary with band names as keys, pixel lists as values.
var result = image.reduceRegion(ee.Reducer.toList(), region, 120);

// Convert the band data to plot on the y-axis to arrays.
var y1 = ee.Array(result.get(band_y1));
//var y2 = ee.Array(result.get('B6'));

// Concatenate the y-axis data by stacking the arrays on the 1-axis.
//var yValues = ee.Array.cat([y1, y2], 1);
var yValues = result.get(band_y1);

// The band data to plot on the x-axis is a List.
var xValues = result.get(band_x);

// Make a band correlation chart.
var chart = ui.Chart.array.values(yValues, 0, xValues)
    .setSeriesNames(['B5', 'B6'])
    .setOptions({
      title: title,
      hAxis: {'title': 'X'},
      vAxis: {'title': '{B5,B6}'},
      pointSize: 3,
});

// Print the chart.
print(chart);
    
}

exports.get_footprint = function(image, res, geometry) {
  return image.int().reduceToVectors({
          geometry: geometry,
          crs: 'EPSG:4326',
          scale: res,
          geometryType: 'polygon',
          eightConnected: false,
          labelProperty: 'bands',
          maxPixels: 1e13
          });
}

exports.get_area_export = function(input_img, input_FC, res, desc_output, do_export, output_drive_folder_name, zone_name) {
  ////////////////////////
  // A FUNCTION to sum AREA (in sq. km) of each value (class) in the input_img within the polygon extent of each feature in input_FC

      // Sum area by class per polygon (sq km) -----------------------------------------
      var area_sqkm = ee.Image.pixelArea().divide(1000000).addBands(input_img).reduceRegions({
            collection: input_FC,
            reducer: ee.Reducer.sum().group(1),
            scale: res
            });
      //print('grouped area raw', area_sqkm);
      
      // Convert output column list to columns
      var area_frmtd = area_sqkm.map(function(feature){
            var list = ee.List(ee.Feature(feature).get('groups'))
            var keys = list.map(function(o) { return ee.Number(ee.Dictionary(o).get('group')).format('%d') })
            var values = list.map(function(o) { return ee.Dictionary(o).get('sum') })
            
            return ee.Feature(feature.geometry(), ee.Dictionary.fromLists(keys, values))
              .copyProperties(feature);
            });
      // remove geometry for export --> https://code.earthengine.google.com/6d0ae2c1953066a4ce2d648a3ffd739a
      var area_frmtd_no_geo = area_frmtd.map(function(feature) {
            return ee.Feature(feature.select([".*"], null, false));
            });
      // This function adds a 'zone' field and sets a zone as a property.
      area_frmtd_no_geo = area_frmtd_no_geo.map(function(feature) {
        return ee.Feature(feature.set({zone_type: zone_name }));
      });
      if(do_export === true){      
        // Export the table that has area values of each pixel value (class) for each polygon in the FC
        Export.table.toDrive({
          collection: area_frmtd_no_geo,
          description: 'AREA_'+desc_output+'_'+res+'m',
          folder: output_drive_folder_name,
          fileNamePrefix: 'AREA_'+desc_output+'_'+res+'m',
          fileFormat: 'CSV'
          });
      } else {
            // Return the table
            return area_frmtd_no_geo;
      }  

};

exports.get_zonalhist_export = function(input_img, input_FC, res, desc_output, output_drive_folder_name) {
  //////////DOESNT WORK AS EXPECTED YET//////////////
  // A FUNCTION to stats of zones in the input_img defined by the features in the input_FC

    var fc_new = input_img.reduceRegions({
          collection: input_FC,
          //reducer: ee.Reducer.mean(),
          reducer: ee.Reducer.fixedHistogram(7,14,14),
          scale: res
        });
      
            // Convert output column list to columns
      fc_new = fc_new.map(function(feature){
            var list = ee.List(ee.Feature(feature).get('histogram'))
            var keys = list.map(function(o) { return ee.Number(ee.Dictionary(o).get('group')).format('%d') })
            var values = list.map(function(o) { return ee.Dictionary(o).get('histogram') })
            
            return ee.Feature(feature.geometry(), ee.Dictionary.fromLists(keys, values))
              .copyProperties(feature);
            });
      
      
      // remove geometry for export --> https://code.earthengine.google.com/6d0ae2c1953066a4ce2d648a3ffd739a
      var fc_fmt_no_geo = fc_new.map(function(feature) {
            return ee.Feature(feature.select([".*"], null, false));
            });
      
      //print('Grouped: Area value (sum) for each Landform Class (group)', area_frmtd);

        var name = 'ZHIST_'+desc_output+'_'+res+'m';
        Export.table.toDrive({
          collection: fc_fmt_no_geo,
          description: name,
          folder: output_drive_folder_name,
          fileNamePrefix: name,
          fileFormat: 'CSV'
          });

  return fc_fmt_no_geo;
};

exports.get_zonalstats_export = function(input_img, input_FC, res, desc_output, do_export, output_drive_folder_name, zone_name) {
  ////////////////////////
  // A FUNCTION to stats of zones in the input_img defined by the features in the input_FC
    var reducer1 = ee.Reducer.count();
    var reducer2 = ee.Reducer.mean();
    var reducer3 = ee.Reducer.median();
    var reducer4 = ee.Reducer.minMax();
    var reducer5 = ee.Reducer.stdDev();
    
    var reducers1 = reducer1.combine({reducer2: reducer2, sharedInputs: true});
    var reducers2 = reducers1.combine({reducer2: reducer3, sharedInputs: true});
    var reducers3 = reducers2.combine({reducer2: reducer4, sharedInputs: true});
    var reducers4 = reducers3.combine({reducer2: reducer5, sharedInputs: true});
    var reducers = reducers4;
    
    // Original method for getting zonal stats
    //https://developers.google.com/earth-engine/debugging#scaling-errors
    /*  
    var fc_new = input_img.reduceRegions({
          collection: input_FC,
          reducer: reducers,//.group({groupField:0, groupName:zoneFieldName}),
          scale: res
        });*/
    // Supposedly better method    
    // This breaks the reduction into smaller tasks.
    var fc_new = input_FC
        //.filter(ee.Filter.neq('lat', 0))
        .map(function(feature) {
      return feature.set(input_img.reduceRegion({
        reducer: reducers,
        geometry: feature.geometry(),
        scale: res,
        maxPixels: 100000000,
        tileScale: 2
      }));
    });
      
      // remove geometry for export --> https://code.earthengine.google.com/6d0ae2c1953066a4ce2d648a3ffd739a
      var fc_fmt_no_geo = fc_new.map(function(feature) {
            return ee.Feature(feature.select([".*"], null, false));
            });
      // This function adds a 'zone' field and sets a zone as a property.
      fc_fmt_no_geo = fc_fmt_no_geo.map(function(feature) {
        return ee.Feature(feature.set({zone_type: zone_name }));
      });
      if(do_export === true){   
        var name = 'ZSTATS_'+desc_output+'_'+res+'m';
        Export.table.toDrive({
          collection: fc_fmt_no_geo,
          description: name,
          folder: output_drive_folder_name,
          fileNamePrefix: name,
          fileFormat: 'CSV'
          });
      } else {
          return fc_fmt_no_geo;
      }
  
};

exports.get_zonalpearsons_export = function(input_img, input_FC, res, desc_output, output_drive_folder_name) {
  ////////////////////////
  // A FUNCTION to get Pearson's Corr for zones of the input_img defined by the features in the input_FC

    var reducer = ee.Reducer.pearsonsCorrelation();
    //var reducer1 = ee.Reducer.count();
    //var reducers = reducer.combine({reducer2: reducer1, sharedInputs: true});
    
    var fc_new = input_img.reduceRegions({
          collection: input_FC,
          reducer: reducer,
          scale: res
        });
      
    // remove geometry for export --> https://code.earthengine.google.com/6d0ae2c1953066a4ce2d648a3ffd739a
    var fc_fmt_no_geo = fc_new.map(function(feature) {
            return ee.Feature(feature.select([".*"], null, false));
            });
      
      //print('Grouped: Area value (sum) for each Landform Class (group)', area_frmtd);
      var name = 'ZPEARSONS_'+desc_output+'_'+res+'m';
      Export.table.toDrive({
        collection: fc_fmt_no_geo,
        description: name,
        folder: output_drive_folder_name,
        fileNamePrefix: name,
        fileFormat: 'CSV'
      });

return fc_new;
};

exports.do_tcc_sampling = function(input_img_src, input_img_ref, input_img_landforms, input_img_other, tcc_type, res, ref_name, src_name, out_folder, get_class) {
  //////////////////////////////////////////////////
  // Validation of coarse input, with finer input
  //   Used first for TTE TCC from Landsat with TCC from LiDAR (LVIS, GLiHT)
  //   input_image are each multi-band: tcc, tcc_abruptness
  
  /////////////////////////////////////////////////
  // PREP validation of TCC
  var tcc_src = input_img_src.select('tcc')
                  .reproject(input_img_ref.select('tcc').projection(), null, res)
                  .mask(input_img_ref.select('tcc'));
                  
  var tcc_ref_src = input_img_ref.select('tcc')
                  .rename('tcc_ref')
                  .addBands(tcc_src.rename('tcc_src'))
                  .mask(tcc_src.rename('tcc_src'))
  
  //print('tcc_lidar_landsat',tcc_lidar_landsat);
  //var tcc_diff = ee.Image(tcc_lidar_landsat.select('tcc_lidar')).subtract(tcc_lidar_landsat.select('tcc_landsat'))
  //Map.addLayer(tcc_diff, {min: -25, max: 25, palette: ['#ca0020','#f7f7f7','#0571b0'].reverse()}, 'TCC Diff: '+lidar_desc+' - Landsat', false)
 
  /////////////////////////////////////////////////
  // PREP validation of Abruptness
  var abruptness_src = input_img_src.select('tcc_abruptness') // selecting the abruptness band  <--- DONT USE BAND NUMBER..USE NAME -- changed from '2'
                  .reproject(input_img_ref.select('tcc').projection(), null, res)
                  .mask(input_img_ref.select('tcc'));
                  
  var abruptness_ref_src = input_img_ref.select('tcc_abruptness')
                        .rename('abruptness_ref')
                        .addBands(abruptness_src.rename('abruptness_src'))
                        .mask(input_img_ref.select('tcc'));
                        
  input_img_landforms = input_img_landforms
                          .reproject(input_img_ref.select('tcc').projection(), null, res)
                          .mask(input_img_ref.select('tcc')); 
  //l.map_landforms(input_img_landforms,'Landforms clip (aspect class styled)');
  
  input_img_other = input_img_other
                          .reproject(input_img_ref.select('tcc').projection(), null, res)
                          .mask(input_img_ref.select('tcc')); 
  
  // Stack (clipped to lidar extent):
  //  tcc from lidar and landsat , abruptness from lidar and landsat, and landforms
  var stack = tcc_ref_src
                        .addBands(abruptness_ref_src)
                        .addBands(input_img_landforms)
                        //.addBands(input_img_other);
                        
  // Add the classification layer to the stack
  if (get_class) {
    stack = stack.addBands(
                  input_img_src.select('tte_classification')
                    .reproject(input_img_ref.select('tcc').projection(), null, res)
                    .mask(input_img_ref.select('tcc'))
                    );
  }  
  
  // Sample the stack
  var SAMPLES_stack_ref_src_landforms = stack
                        .sample({projection: input_img_ref.select(0).projection(),
                                  scale: res, 
                                  geometries: false});
  // Export the SAMPLE table                        
  Export.table.toDrive({
    folder: out_folder,
    collection: SAMPLES_stack_ref_src_landforms,
    description: 'SAMPLES_stack_'+ref_name+'_'+src_name+'_landforms_'+tcc_type,
    fileNamePrefix: 'SAMPLES_stack_'+ref_name+'_'+src_name+'_landforms_'+tcc_type,
    fileFormat: 'CSV'
  });

  //return stack;
  return SAMPLES_stack_ref_src_landforms;
}

exports.get_area_map = function(input_img, input_FC, res) {
  ////////////////////////
  // A FUNCTION to sum AREA of each value in the input_img within the extent of each input_FC

      // Sum area by class per polygon (sq km) -----------------------------------------
      var area_sqkm = ee.Image.pixelArea().divide(1000000).addBands(input_img).reduceRegions({
            collection: input_FC,
            reducer: ee.Reducer.sum().group(1),
            scale: res
            });
      //print('grouped area raw', area_sqkm);
      
      // Convert output column list to columns
      var area_frmtd = area_sqkm.map(function(feature){
            var list = ee.List(ee.Feature(feature).get('groups'))
            var keys = list.map(function(o) { return ee.Number(ee.Dictionary(o).get('group')).format('%d') })
            var values = list.map(function(o) { return ee.Dictionary(o).get('sum') })
            
            return ee.Feature(feature.geometry(), ee.Dictionary.fromLists(keys, values))
              .copyProperties(feature);
            });
};

exports.do_aspect_class = function(dem, kernRadius) {
  
  // Calculate the aspect, slope throughout the dem
  var asp = ee.Terrain.aspect(dem);
  var slope = ee.Terrain.slope(dem)
  
  // Create a blank image to use to perform operations
  var blank = ee.Image(0);
  
  //Define boundaries for minumum and maximum of north and south facing data
  var nFacingMin = 315.0
  var nFacingMax = 45.0
  var eFacingMin = 45.001
  var eFacingMax = 134.999
  var sFacingMin = 135.0
  var sFacingMax = 225.0
  var wFacingMin = 225.001
  var wFacingMax = 314.999
  
  // For Aspect Classification
  var minSlope = 80;
  var maxSlope = 90;
      
  // Where are the north and south facing slopes
  var isNfacing = blank.where(
                            asp.lte(nFacingMax)
                            .or(asp.gte(nFacingMin))
                            .and(slope.gt(minSlope))
                            .and(slope.lt(maxSlope))
                            ,1.0);
  var isSfacing = blank.where(
                          asp.lte(sFacingMax)
                          .and(asp.gte(sFacingMin))
                          .and(slope.gt(minSlope))
                          .and(slope.lt(maxSlope))
                          ,1.0);
  var isEfacing = blank.where(
                          asp.lte(eFacingMax)
                          .and(asp.gte(eFacingMin))
                          .and(slope.gt(minSlope))
                          .and(slope.lt(maxSlope))
                          ,1.0);
  var isWfacing = blank.where(
                          asp.lte(wFacingMax)
                          .and(asp.gte(wFacingMin))
                          .and(slope.gt(minSlope))
                          .and(slope.lt(maxSlope))
                          ,1.0);
  //Map.addLayer(water_max_mask, {}, 'water_max_mask');
  var Nface = slope.updateMask(isNfacing);
  var Sface = slope.updateMask(isSfacing);
  var Eface = slope.updateMask(isEfacing);
  var Wface = slope.updateMask(isWfacing);
  
  var NFmin = Nface.focal_min(kernRadius,'square','meters',1);
  var SFmin = Sface.focal_min(kernRadius,'square','meters',1);
  var EFmin = Eface.focal_min(kernRadius,'square','meters',1);
  var WFmin = Wface.focal_min(kernRadius,'square','meters',1);
  
  var sface_pal = ['#ffffb2','#fed976','#feb24c','#fd8d3c','#fc4e2a','#e31a1c','#b10026'];
  var nface_pal = ['#ffffb2','#c7e9b4','#7fcdbb','#41b6c4','#1d91c0','#225ea8','#0c2c84']; //blues (cold)
  var eface_pal = ['#ffffcc','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#005a32'];
  var wface_pal = ['#ffffcc','#fcc5c0','#fa9fb5','#f768a1','#dd3497','#ae017e','#7a0177'];
  var mapface=1;
  
  if (mapface==1){
    Map.addLayer(Nface, {min: 1, max:25, palette : nface_pal }, 'North Face');
    Map.addLayer(Sface, {min: 1, max:25, palette : sface_pal }, 'South Face');
    Map.addLayer(Eface, {min: 1, max:25, palette : eface_pal }, 'East Face');
    Map.addLayer(Wface, {min: 1, max:25, palette : wface_pal }, 'West Face');
  }
}; 

exports.map_tte_class_layer = function(tte_data, tte_version, opacity, SHOW_LAYER, ADD_LEGEND){
  
   var tte_class_pal = ['#5255a3','#1796a3','#fdbf6f','#ff7f00', //sparse
                       '#ffffbf','#d9ef8b','#91cf60','#1a9850', //open
                       '#c4c4c4','red', 'blue'];                //Intermediate w/ high rel err; leading edge non-water; leading edge water

  var tte_data_class_viz = {min:1, max:11, opacity: opacity, palette: tte_class_pal};  
  
  Map.addLayer(tte_data.select('tte_classification'), tte_data_class_viz, "TTE Classification "+tte_version, SHOW_LAYER); 

  exports.makeMapGrey();
  
  if(ADD_LEGEND){
/*    exports.add_legend('Forest Structure Pattern Classes',
                            ['Sparse TCC <= 5% & Uniform gradient',
                            'Sparse TCC <= 5% & Diffuse-gradual gradient',
                            'Sparse TCC <= 5% & Diffuse-rapid gradient',
                            'Sparse TCC <= 5% & Abrupt gradient',
                            'Open TCC 6-30% & Uniform gradient',
                            'Open TCC 6-30% & Diffuse-gradual gradient',
                            'Open TCC 6-30% & Diffuse-rapid gradient',
                            'Open TCC 6-30% & Abrupt gradient',
                            'Intermediate & Closed Canopies TCC > 30%', //(TTE ZONES 3 & 4)
                            'Forest Edge: Not-Water Adjacent',
                            'Forest Edge: Water Adjacent'],
                            tte_class_pal); 
                            */
    exports.add_legend('Forest Structure Pattern Classes',
                            ['Sparse & Uniform',
                            'Sparse & Diffuse-gradual',
                            'Sparse & Diffuse-rapid',
                            'Sparse & Abrupt ',
                            'Open & Uniform ',
                            'Open & Diffuse-gradual',
                            'Open & Diffuse-rapid',
                            'Open & Abrupt',
                            'Intermediate & Closed', //(TTE ZONES 3 & 4)
                            'Non-forest edge (dry)',
                            'Non-forest edge (wet)'],
                            tte_class_pal);                             
  }
}


exports.map_modis_lc_layer = function(year, opacity, SHOW_LAYER, ADD_LEGEND){
  
  var hybas_1 = ee.FeatureCollection("WWF/HydroSHEDS/v1/Basins/hybas_1")
  var dataset = ee.ImageCollection('MODIS/006/MCD12Q1')
  .filterDate(year+'-01-01', year+'-12-31')
  .median()
  
  var igbpLandCover = dataset.select('LC_Type1');
  var pal_modis_igbp = [
      '05450a', '086a10', '54a708', '78d203', '009900', 'c6b044', 'dcd159',
      'dade48', 'fbff13', 'b6ff05', '27ff87', 'c24f44', 'a5a5a5', 'ff6d4c',
      '69fff8', 'f9ffa4', '1c0dff'
    ];
    
  var igbpLandCoverVis = {
    min: 1.0,
    max: 17.0,
    opacity: opacity,
    palette: pal_modis_igbp,
  };
  //var tte_data_class_viz = {min:1, max:11, opacity: opacity, palette: tte_class_pal};  
    
  Map.addLayer(igbpLandCover.clip(hybas_1), igbpLandCoverVis, 'IGBP Land Cover');

  exports.makeMapGrey();
  
  if(ADD_LEGEND){

    exports.add_legend('Land cover ('+year+'; IGBP (MODIS)',
                          [ 'Forest: evergreen (needle); >2m ht., >60% canopy',
                            'Forest: evergreen (broad); >2m ht., >60% canopy',
                            'Forest: deciduous (needle); >2m ht., >60% canopy',
                            'Forest: deciduous (broad); >2m ht., >60% canopy',
                            'Forest: mixed; >2m ht.',
                            'Shrublands: closed; 1-2m ht., >60% canopy',
                            'Shrublands: open; 1-2m ht., 10-60% canopy',
                            'Woody savannas: 30-60% canopy',
                            'Savannas: 10-30% canopy', //(TTE ZONES 3 & 4)
                            'Grasslands',
                            'Perm. Wetlands',
                            'Croplands',
                            'Urban/built',
                            'Cropland/Natural Vegetation Mosaics',
                            'Snow (permanent)',
                            'Barren',
                            'Water'],
                            pal_modis_igbp);                             
  }
}



// Clean up featurecollection so is contains only (Multi)Polygons
//------------------------------------------------------------------
// Clean a polygon from other types of geometries (eg. lines, points,...)
exports.clean_polygon_feature = function(feature) {
  //https://code.earthengine.google.com/e69b4b9b81a5965e08c07c262b5e2966
  /*  Run:
        var fcStates = fcStates.map(clean_polygon_feature);
  */
   // Remove all non-polygons from a geometry
   function remove_non_polygons(geometry) { 
   return ee.Algorithms.If(ee.Algorithms.IsEqual(ee.Geometry(geometry).type()
                          , ee.String('Polygon'))
                          , ee.Feature(ee.Geometry(geometry)), null);
   }
  
    var geometries = feature.geometry().geometries();
    var geometries_cleaned = ee.FeatureCollection(geometries.map(remove_non_polygons)).union().first();
    return ee.Feature(feature).setGeometry(geometries_cleaned.geometry());
}

// Function to mask clouds using the Sentinel-2 QA band.
exports.maskS2clouds = function (image) {
  var qa = image.select('QA60')

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = ee.Number(2).pow(10).int()
  var cirrusBitMask = ee.Number(2).pow(11).int()

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(
             qa.bitwiseAnd(cirrusBitMask).eq(0))

  // Return the masked and scaled data, without the QA bands.
  return image.updateMask(mask).divide(10000)
      .select("B.*")
      .copyProperties(image, ["system:time_start"])
}
exports.mapWater = function(water_opacity, water_freq_min_value ){
  // Water Filling (by M. Macander)
var waterOcc = ee.Image("JRC/GSW1_1/GlobalSurfaceWater").select('occurrence'),
    jrc_data0 = ee.Image("JRC/GSW1_0/Metadata").select('total_obs').lte(water_freq_min_value),
    waterOccFilled = waterOcc.unmask(water_freq_min_value).max(jrc_data0),
    waterMask = waterOccFilled.lt(50);
Map.addLayer(waterOcc, {opacity: water_opacity}, 'Water occurrence > '+water_freq_min_value, true);
}
//https://developers.google.com/earth-engine/tutorials/community/extract-raster-values-for-points?hl=en
exports.bufferPoints = function(radius, bounds) {
  return function(pt) {
    pt = ee.Feature(pt);
    return bounds ? pt.buffer(radius).bounds() : pt.buffer(radius);
  };
}
exports.zonalStats = function(ic, fc, params) {
  // Initialize internal params dictionary.
  var _params = {
    reducer: ee.Reducer.mean(),
    scale: null,
    crs: null,
    bands: null,
    bandsRename: null,
    imgProps: null,
    imgPropsRename: null,
    datetimeName: 'datetime',
    datetimeFormat: 'YYYY-MM-dd HH:MM:ss'
  };

  // Replace initialized params with provided params.
  if (params) {
    for (var param in params) {
      _params[param] = params[param] || _params[param];
    }
  }

  // Set default parameters based on an image representative.
  var imgRep = ic.first();
  var nonSystemImgProps = ee.Feature(null)
    .copyProperties(imgRep).propertyNames();
  if (!_params.bands) _params.bands = imgRep.bandNames();
  if (!_params.bandsRename) _params.bandsRename = _params.bands;
  if (!_params.imgProps) _params.imgProps = nonSystemImgProps;
  if (!_params.imgPropsRename) _params.imgPropsRename = _params.imgProps;

  // Map the reduceRegions function over the image collection.
  var results = ic.map(function(img) {
    // Select bands (optionally rename), set a datetime & timestamp property.
    img = ee.Image(img.select(_params.bands, _params.bandsRename))
      .set(_params.datetimeName, img.date().format(_params.datetimeFormat))
      .set('timestamp', img.get('system:time_start'));

    // Define final image property dictionary to set in output features.
    var propsFrom = ee.List(_params.imgProps)
      .cat(ee.List([_params.datetimeName, 'timestamp']));
    var propsTo = ee.List(_params.imgPropsRename)
      .cat(ee.List([_params.datetimeName, 'timestamp']));
    var imgProps = img.toDictionary(propsFrom).rename(propsFrom, propsTo);

    // Subset points that intersect the given image.
    var fcSub = fc.filterBounds(img.geometry());

    // Reduce the image by regions.
    return img.reduceRegions({
      collection: fcSub,
      reducer: _params.reducer,
      scale: _params.scale,
      crs: _params.crs
    })
    // Add metadata to each feature.
    .map(function(f) {
      return f.set(imgProps);
    });
  }).flatten().filter(ee.Filter.notNull(_params.bandsRename));

  return results;
}

exports.lc_legend = function(image, BAND_NAME, legend_title, min_val, max_val){
  // Adapted from: https://code.earthengine.google.com/effc3d4ec4336d42db857f1e554074ac

  // Create the panel for the legend items.
  var legend = ui.Panel({
    style: {
      position: 'bottom-left',
      padding: '8px 15px'
    }
  });
  
  // Create and add the legend title.
  var legendTitle = ui.Label({
    value: legend_title,
    style: {
      fontWeight: 'bold',
      fontSize: '18px',
      margin: '0 0 4px 0',
      padding: '0'
    }
  });
  legend.add(legendTitle);
  
  var loading = ui.Label('Loading legend...', {margin: '2px 0 4px 0'});
  legend.add(loading);
  
  // Creates and styles 1 row of the legend.
  var makeRow = function(color, name) {
    // Create the label that is actually the colored box.
    var colorBox = ui.Label({
      style: {
        backgroundColor: '#' + color,
        // Use padding to give the box height and width.
        padding: '8px',
        margin: '0 0 4px 0'
      }
    });
  
    // Create the label filled with the description text.
    var description = ui.Label({
      value: name,
      style: {margin: '0 0 4px 6px'}
    });
  
    return ui.Panel({
      widgets: [colorBox, description],
      layout: ui.Panel.Layout.Flow('horizontal')
    });
  };
  
  // Get the list of palette colors and class names from the image.
  image.toDictionary().select([BAND_NAME + ".*"]).evaluate(function(result) {
    var palette = result[BAND_NAME + "_class_palette"];
    var names = result[BAND_NAME + "_class_names"];
    var values = result[BAND_NAME + "_class_values"];
    loading.style().set('shown', false);
    
    for (var i = 0; i < names.length; i++) {
      legend.add(makeRow(palette[i], names[i]));
    }
    var lc_viz = {min: min_val, max: max_val, palette: palette}
    //Map.addLayer(image, lc_viz, legend_title);
    
  });
  Map.addLayer(image, lc_viz, legend_title);
  // Try to return viz
  //var lc_viz = image.select(BAND_NAME)
  // Add the legend to the map.
  Map.add(legend);
  
  //return lc_viz
}