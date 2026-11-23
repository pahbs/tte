/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var tte_data = ee.Image("projects/foreststructure/TTE_DATA_v201902v2"),
    dem = ee.Image("MERIT/DEM/v1_0_3"),
    hybas_1 = ee.FeatureCollection("WWF/HydroSHEDS/v1/Basins/hybas_1");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
////////////////////////////////
// Functions 
var add_legend = function(title, subtitle, citation, DOI, lbl, pal) {
  var legend = ui.Panel({style: {position: 'bottom-left'}}), entry;
  legend.add(ui.Label({value: title, style: { fontWeight: 'bold', fontSize: '16px', margin: '0 0 0px 0', padding: '1px' } }));
  legend.add(ui.Label({value: subtitle, style: { fontWeight: 'bold', fontSize: '14px', margin: '0 0 4px 0', padding: '1px' } }));
  legend.add(ui.Label({value: citation, style: { fontSize: '10px', margin: '0 0 0px 0', padding: '0px' } }));
  legend.add(ui.Label({value: DOI, style: { fontSize: '10px', margin: '0 0 2px 0', padding: '0px' } }));
  for (var x = 0; x < lbl.length; x++){
    entry = [ ui.Label({style:{color: pal[x], margin: '0 0 4px 0'}, value: '██'}),
      ui.Label({ value: lbl[x], style: {fontSize: '14px', margin: '0 0 4px 4px' } }) ];
    legend.add(ui.Panel(entry, ui.Panel.Layout.Flow('horizontal')))
  }
  Map.add(legend);
}
var makeMapGrey = function() {
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
/////////////////////////////////////////////////
var hs_dem = ee.Terrain.hillshade(dem, 315, 15).clip(hybas_1) //10

var open_labs   = ['Open & Uniform', 'Open & Diffuse-gradual','Open & Diffuse-rapid','Open & Abrupt']//.reverse() //open
var sparse_labs = ['Sparse & Uniform', 'Sparse & Diffuse-gradual', 'Sparse & Diffuse-rapid', 'Sparse & Abrupt']//.reverse() //sparse
var other_labs  = ['Intermediate & Closed','Non-forest edge (dry)','Non-forest edge (wet)'];
var tte_class_labs = sparse_labs.reverse().concat(open_labs.concat(other_labs))

var open_pal   = ['#ffffbf','#d9ef8b','#91cf60','#1a9850']
var sparse_pal = ['#5255a3','#1796a3','#fdbf6f','#ff7f00']
var other_pal  = ['#c4c4c4','red', 'blue']
var tte_class_pal = sparse_pal.concat(open_pal.concat(other_pal));

// Set up visualization
var tte_data_class_viz = {min:1, max:11, palette: tte_class_pal};     

// Map layers
Map.setCenter(-110, 65, 4.5)
makeMapGrey()
Map.addLayer(hs_dem, {},'Hillshade')
Map.addLayer(tte_data.select('tte_classification'), tte_data_class_viz, "TTE Classification ", true)
add_legend('Taiga-Tundra Ecotone','Forest Structure Pattern Classes', 'Montesano et al 2020 Environ. Res. Lett. 15 105019', 'https://doi.org/10.1088/1748-9326/abb2c7', tte_class_labs, tte_class_pal)
//Map.add(fs.return_legend('Taiga-tundra ecotone forest structure pattern classes', tte_class_labs, tte_class_pal))