/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var imageCollection = ee.ImageCollection("MODIS/006/MCD64A1"),
    dg_tte = ee.ImageCollection("projects/foreststructure/Alaska_Working/HRSI/tte_examples_20200422"),
    tdx90_e = ee.Image("projects/foreststructure/TDM1_DEM_90m_circ_DEM_E_laea"),
    tdx90_w = ee.Image("projects/foreststructure/TDM1_DEM_90m_circ_DEM_W_laea"),
    hybas_1 = ee.FeatureCollection("WWF/HydroSHEDS/v1/Basins/hybas_1"),
    dem_arctic = ee.Image("UMN/PGC/ArcticDEM/V3/2m_mosaic"),
    image = ee.Image("UMN/PGC/ArcticDEM/V2/5m"),
    imageCollection2 = ee.ImageCollection("UMN/PGC/ArcticDEM/V3/2m"),
    tte_data = ee.Image("projects/foreststructure/TTE_DATA_v201902v2");
/***** End of imports. If edited, may not auto-convert in the playground. *****/
/*
The bioclimatic extent and pattern of the taiga-tundra ecotone

      Derived from TCC estimates (excluding vast areas where TCC = 0 AND Abruptness = 0, which is meaningless):
        [1] Calibrated 2m TCC (Montesano et al. & Sexton et al.) used within the TTE DOMAIN of N.America and Eurasian west of Yenesei R. (geWnerally, non-permafrost larch areas) 
        [2] Mean of orig 2m TCC (Sexton et. al) and hansen2000 (Hansen et al 2013) used for:
          [a] Eurasian larch areas (WWF regions east of Yenisei R.) AND 
          [b] Eurasian non-larch areas associated with:
            [a] WWF 'ecoid' 81114, 80611, 81111, 81108, 80608, 81106, 80606
            [b] WWF 'econum' 10
  TTE Zone 1: Sporadic <= 5% TCC --> This is the "TTE Biome Boundary" (includes 0% TCC that is adjacent to a pixel > 0% TCC)                                              
  TTE Zone 2: Open Canopy 6% - 30% TCC
  TTE Zone 3: Intermediate Canopy > 30% TCC & TCC relative error > 50%
  TTE Zone 4: Intermediate Canopy > 30% TCC & TCC relative error lte 50%  
  */

// topography
var transform_tdx90_w = tdx90_w.projection().getInfo().transform;
var dem= ee.ImageCollection([tdx90_w, tdx90_e]).mosaic()
  .setDefaultProjection('EPSG:3338', transform_tdx90_w)
var hs = ee.Terrain.hillshade(dem,315,10).clip(hybas_1)
var hs_arcticdem = ee.Terrain.hillshade(dem_arctic.select('elevation'), 315, 10).clip(hybas_1)

  var tte_data_zones_pal = ['#d7191c','#ffffbf','#a6d96a','#1a9641'];
  var tte_data_zones_pal = ['#fc8d59','#ffffbf','#91cf60','#cccccc'];
  var tte_data_zones_pal = ['#fc8d59','#63d062', '#058d16']//,'#058d16'];
  var tte_data_zones_labs = ['Sparse', 'Open', 'Intermediate & Closed']//, 'Intermediate']
  var tte_data_zones_viz = {min: 1, max: 3, palette: tte_data_zones_pal};
  //Map.addLayer(tte_data.select('tte_zones'), tte_data_zones_viz, "TTE Zones ", false);                                 
  /*
  Circumpolar TTE Abruptness (the normalized difference spatial rate of chance in tree cover within TTE Zones)
  */
  var pal_abrupt = ['#d7191c','#fdae61','#ffffbf','#abdda4','#2b83ba'].reverse()
  var tte_data_abruptness_viz = {min: -1, max: 1, palette: pal_abrupt};
 // Map.addLayer(tte_data.select('tte_abruptness'), tte_data_abruptness_viz, "TTE Abruptness ", false); 
  /*
  Circumpolar TTE Classification (based on the spatial rate of change in tree cover within TTE Zones)
  */
  //var tte_data_class_viz = {min:1, max:9, palette: ['#5255a3','#1796a3','#fdae61','#d7191c','#ffffbf','#d9ef8b','#91cf60','#1a9850','gray']};

  var open_labs = ['Open & Uniform', 'Open & Diffuse-gradual','Open & Diffuse-rapid','Open & Abrupt']//.reverse() //open
  var sparse_labs = ['Sparse & Uniform', 'Sparse & Diffuse-gradual', 'Sparse & Diffuse-rapid', 'Sparse & Abrupt']//.reverse() //sparse
  var other_labs = ['Intermediate & Closed','Non-forest edge (dry)','Non-forest edge (wet)'];
  
  var tte_class_labs = open_labs.reverse().concat(sparse_labs.concat(other_labs))
  var tte_class_labs = sparse_labs.reverse().concat(open_labs.concat(other_labs))

   var open_pal = ['#ffffbf','#d9ef8b','#91cf60','#1a9850']//.reverse()
   var sparse_pal = ['#5255a3','#1796a3','#fdbf6f','#ff7f00']//.reverse()
   var other_pal = ['#c4c4c4','red', 'blue']  //Intermediate w/ high rel err; leading edge non-water; leading edge water

  var tte_class_pal = open_pal.concat(sparse_pal.concat(other_pal));
  var tte_class_pal = sparse_pal.concat(open_pal.concat(other_pal));

print(tte_class_labs)
print(tte_class_pal)                                  
  var tte_data_class_viz = {min:1, max:11, palette: tte_class_pal};                    
  //Map.addLayer(tte_data.select('tte_classification'), tte_data_class_viz, "TTE Classification ", false); 
  
  
var dataset = ee.ImageCollection('MODIS/006/MCD64A1')
                  .filter(ee.Filter.date('2000-01-01', '2010-12-31'));
var burnedArea = dataset.select('BurnDate');
var burnedAreaVis = {
  min: 30.0,
  max: 341.0,
  palette: ['4e0400', '951003', 'c61503', 'ff1901'],
};

  
  
//////////////////////////////////////////////////
// Map Legends, etc
//
/////////////////////////////////////////////////
var fs = require('users/paulmontesano/montesano:mod_forest_structure.js');
//fs.makeMapGrey()
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

//fs.add_legend('TTE bioclimatic extent & pattern classification', tte_class_labs, tte_class_pal)
                          
                          

var left = ui.Map();
var center = ui.Map();
var right2 = ui.Map();
var right3 = ui.Map();
ui.root.clear();
ui.root.add(left);
ui.root.add(center);
ui.root.add(right2);
ui.root.add(right3);


//ui.Map.Linker([left, center, right2, right3], 'change-bounds');
ui.Map.Linker([left, center, right2, right3], 'change-bounds');

//left.setCenter(158.9695, 68.6847, 9) // Kolyma
//left.setCenter(127.3266, 71.4809, 9) // Tit Ary, Lena
//left.setCenter(102.294, 72.12, 9) // AryMas, Lukunsky
//left.setCenter(68.2141, 68.0353, 9) // yamal
//left.setCenter(65.462, 67.114, 9) // polar Urals
 //left.setCenter(65.649167, 66.855278, 9) // polar urals shiyatove,mazepa  
//left.setCenter(54.805, 67.481, 9) // EU west
//left.setCenter(-72.074, 56.897, 9) // northern Quebec
//left.setCenter(-115.9508, 65.5719, 9) // Great Bear Lake Canadian Shield
//left.setCenter(-117.6466, 66.1808, 12) // Great Bear
//left.setCenter(-134.623, 68.047, 9) // Mackenzie Delta
//left.setCenter(-163.057, 62.4, 9) // Yukon-Kuskokwim Delta
left.setCenter(-65.43733, 56.28117, 15) //HRSI supplemental
left.addLayer(hs, {},'hs TDX')
left.addLayer(hs_arcticdem, {},'hs arcticdem')
left.addLayer(tte_data.select('tte_domain'), {palette: ["#787878"]}, "Bioclimatic Env ", true) 
left.addLayer(tte_data.select('tte_zones'), tte_data_zones_viz, "TTE Zones ", true) 
//left.add(ui.Label('Magnitude of TCC',{position: 'top-left',fontSize:'24px',backgroundColor:'white'}))
left.setOptions('Gray', {'Gray': GRAY});
left.add(fs.return_legend('Magnitude of TCC', tte_data_zones_labs, tte_data_zones_pal))

center.addLayer(hs, {},'hs TDX')
center.addLayer(hs_arcticdem, {},'hs arcticdem')
center.addLayer(tte_data.select('tte_domain'), {palette: ["#787878"]}, "Bioclimatic Env ", true) 
center.addLayer(tte_data.select('tte_abruptness'), tte_data_abruptness_viz, "TTE Abruptness ", true)
//center.add(ui.Label('Abruptness of TCC',{position: 'top-left',fontSize:'24px',backgroundColor:'white'}))
center.setOptions('Gray', {'Gray': GRAY});
center.add(fs.return_legend('Gradient of TCC', ['Uniform','','Diffuse','','Abrupt'], pal_abrupt))

right2.addLayer(hs, {},'hs TDX')
right2.addLayer(hs_arcticdem, {},'hs arcticdem')
right2.addLayer(tte_data.select('tte_domain'), {palette: ["#787878"]}, "Bioclimatic Env ", true) 
right2.addLayer(tte_data.select('tte_classification'), tte_data_class_viz, "TTE Classification ", true)
//right2.add(ui.Label('Forest structure pattern classes',{position: 'top-left',fontSize:'24px',backgroundColor:'white'}))
right2.setOptions('Gray', {'Gray': GRAY});
right2.add(fs.return_legend('Forest structure pattern classes', tte_class_labs, tte_class_pal))

    var dgCirViz = {bands: ['b7', 'b5', 'b3'], min:1, max:[200,125,125]},
      dgRgbViz = {bands: ['b5', 'b3', 'b2'], gamma:0.7};
      
  var dg_tte_ms = dg_tte.filterMetadata('type', 'equals', 'MUL').mosaic();
  var dg_tte_pan = dg_tte.filterMetadata('type', 'equals', 'PAN').mosaic();
  
right3.addLayer(hs, {},'hs TDX')
right3.addLayer(hs_arcticdem, {},'hs arcticdem')
right3.addLayer(dg_tte_ms, dgCirViz, 'HRSI ms');
  //Map.addLayer(dg_tte_pan, {}, 'HRSI pan', false);

//right3.addLayer(burnedArea, burnedAreaVis, 'MODIS Burned Area', true);

right3.add(ui.Label('Worldview-2',{position: 'bottom-left',fontSize:'24px',backgroundColor:'white'}))
right3.setOptions('Gray', {'Gray': GRAY});

