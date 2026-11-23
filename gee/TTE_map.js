/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var LVIS2017 = ee.FeatureCollection("users/paulmontesano/arc/LVIS_FLown_Lines_20170926"),
    ecoregions = ee.FeatureCollection("users/paulmontesano/arc/wwf_terr_ecos_taiga-tundra"),
    tpi = ee.Image("CSP/ERGo/1_0/Global/ALOS_mTPI"),
    dem = ee.Image("UMN/PGC/ArcticDEM/V3/2m_mosaic"),
    test_geom = /* color: #d63000 */ee.FeatureCollection(
        [ee.Feature(
            ee.Geometry.Polygon(
                [[[-157.5668756538746, 67.4638621589981],
                  [-159.32150160649542, 67.64862179918971],
                  [-159.18429379099473, 67.31376442234462],
                  [-156.29800137578889, 67.11984848120571],
                  [-153.2543051004006, 67.22980479963893],
                  [-151.58895528521384, 67.10017255007098],
                  [-149.1781303068309, 67.46083895712357],
                  [-148.56808896048568, 67.80740806832567],
                  [-151.25364038870663, 68.01383823108704],
                  [-156.58699556136173, 67.82765878610694]]]),
            {
              "system:index": "0"
            }),
        ee.Feature(
            ee.Geometry.Polygon(
                [[[-115.04734106786987, 64.98612541939362],
                  [-115.57959471378479, 64.68233910971561],
                  [-115.14611012936973, 64.36872461973499],
                  [-114.31337275491228, 64.04768702544207],
                  [-113.13664273514826, 64.09575662096391],
                  [-112.58445631782917, 64.5373574884746],
                  [-113.18305456573114, 64.80238197761312],
                  [-114.24788458294313, 65.08996344753717]]]),
            {
              "system:index": "1"
            })]),
    QB_val_pts = ee.FeatureCollection("users/paulmontesano/arc/vcf_validation_points_433_with_zone"),
    countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017"),
    na_region = /* color: #d63000 */ee.Geometry.Polygon(
        [[[-136.15263666828776, 71.20547585054963],
          [-167.61748041828776, 70.68907159264684],
          [-169.37529291828776, 63.258378212792095],
          [-166.21123041828776, 53.572968314885735],
          [-130.00029291828776, 54.297323014685134],
          [-127.89091791828776, 55.559737797236856],
          [-135.80107416828776, 61.92346595537197],
          [-127.18779291828776, 59.91650876953927],
          [-122.09013666828776, 59.872423340928925],
          [-119.89287104328776, 62.61863849575642],
          [-106.88505854328776, 57.827232340252976],
          [-87.46123041828776, 51.433495625035675],
          [-72.08037104328776, 49.41815355433591],
          [-51.162402293287755, 51.59757902899413],
          [-22.836740192776915, 60.598545747071014],
          [-48.877246043287755, 73.11538976332832],
          [-76.12333979328776, 63.53388973184286]]]),
    eu_region = /* color: #98ff00 */ee.Geometry.Polygon(
        [[[43.1584992953093, 68.84728969397605],
          [65.4827180453093, 69.83926342759068],
          [73.5686555453093, 71.6909659453054],
          [126.8303742953093, 73.07354066230806],
          [130.1702180453093, 71.63566515695962],
          [150.9124055453093, 71.13065129403307],
          [-170.06415695469065, 68.07291629947453],
          [-169.36103195469065, 64.16765363806203],
          [178.6858430453093, 61.26973277518552],
          [157.7678742953093, 53.53968923034665],
          [128.8518586703093, 58.90410846407983],
          [128.5881867953093, 58.94947169981624],
          [128.07227884255872, 58.93479478696019],
          [127.97710228023516, 58.932420130157354],
          [118.3928742953093, 56.26718343749969],
          [115.31670242030941, 55.874727273728126],
          [106.6155305453093, 49.78059237739379],
          [89.0374055453093, 48.921815753741164],
          [76.8206086703093, 55.42842320067726],
          [58.2756867953093, 57.51526419512813],
          [58.0999055453093, 57.703591451078914],
          [41.5764680453093, 61.015220752254464],
          [26.986624295309298, 61.26973277518552],
          [21.361624295309298, 62.185528485171865],
          [19.428030545309298, 57.797389541931715],
          [2.728811795309298, 56.9444067959265],
          [-20.862267779705917, 60.91272863648922],
          [-27.681344454690702, 66.23103822289278],
          [21.888968045309298, 72.12761704325449]]]),
    cavm = ee.FeatureCollection("users/paulmontesano/arc/CAVM_treeline"),
    LVIS2017_30m = ee.Image("users/mmacander/above_mapping/lvis2_30m_above2017_ret_1p5m_to_5p0m_ge12obs"),
    test_nsib = /* color: #d63000 */ee.Geometry.Polygon(
        [[[99.68480691429284, 67.55259028899289],
          [99.2614740766004, 67.25541918056051],
          [99.82591363025199, 66.08201789721961],
          [99.84322996213905, 66.96680038945503],
          [99.73728027725474, 67.2142483078771],
          [100.3858920522955, 67.73304834922689]]]),
    test_brooks = /* color: #d63000 */ee.Geometry.MultiPolygon(
        [[[[-150.56835028864054, 67.73815673402024],
           [-151.16915586730028, 67.3038532940654],
           [-150.24064441730138, 66.76251628489265],
           [-149.65085338226902, 67.517835594212]]],
         [[[-150.10137140373007, 67.2620406949711],
           [-150.31560480216757, 67.2620406949711],
           [-150.46941339591757, 67.07874960059912],
           [-150.29363214591757, 67.05520478641128]]]]),
    dem_strips = ee.ImageCollection("UMN/PGC/ArcticDEM/V2/2m"),
    mod_land_water = ee.ImageCollection("MODIS/006/MOD44W"),
    geometry = /* color: #d63000 */ee.Geometry.MultiPoint(),
    hydrob_arc_L06 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_ar_lev06_v1c"),
    hydrob_arc_L12 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_ar_lev12_v1c"),
    hydrob_eu_L06 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_eu_lev06_v1c"),
    hydrob_eu_L12 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_eu_lev12_v1c"),
    hydrob_na_L06 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_na_lev06_v1c"),
    hydrob_na_L12 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_na_lev12_v1c"),
    hydrob_sib_L06 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_si_lev06_v1c"),
    hydrob_sib_L12 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_si_lev12_v1c"),
    permprob = ee.Image("users/paulmontesano/UiO_PEX_PERPROB_30_20171201_2000_2016"),
    GLIHT_CHM_5m = ee.Image("users/mmacander/above_mapping/GLiHT_2014_AK_CHM_5m_102001_cm"),
    plots = ee.FeatureCollection("users/paulmontesano/arc/eurasia_forest_structure_plots_new"),
    tdx90_e = ee.Image("projects/mangrovescience/boreal/TDM1_DEM_90m_circ_DEM_E_laea"),
    tdx90_w = ee.Image("projects/mangrovescience/boreal/TDM1_DEM_90m_circ_DEM_W_laea"),
    hydrob_arc_L02 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_ar_lev02_v1c"),
    hydrob_eu_L02 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_eu_lev02_v1c"),
    hydrob_na_L02 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_na_lev02_v1c"),
    hydrob_sib_L02 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_si_lev02_v1c"),
    hydrob_arc_L03 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_ar_lev03_v1c"),
    hydrob_eu_L03 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_eu_lev03_v1c"),
    hydrob_na_L03 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_na_lev03_v1c"),
    hydrob_sib_L03 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_si_lev03_v1c"),
    bioclim_iso_10C = ee.Image("users/paulmontesano/bioclim_isotherm_10C_wrm_qrt"),
    bioclim_sides = ee.Image("users/paulmontesano/TTE_BIOCLIM_SIDES"),
    landforms = ee.Image("projects/mangrovescience/boreal/LANDFORMS_TDX90"),
    bioclim_envelope = ee.FeatureCollection("users/paulmontesano/bioclim_envelope_mask"),
    ecoregion_extent = ee.FeatureCollection("users/paulmontesano/ecoregion_extent_mask"),
    tte_data_v201902 = ee.Image("projects/mangrovescience/boreal/TTE_DATA_v201902"),
    forest_ht = ee.Image("NASA/JPL/global_forest_canopy_height_2005"),
    bio2 = ee.Image("users/kd498/bioclim2_1km"),
    hydrob_arc_L08 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_ar_lev08_v1c"),
    hydrob_eu_L08 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_eu_lev08_v1c"),
    hydrob_na_L08 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_na_lev08_v1c"),
    hydrob_sib_L08 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_si_lev08_v1c"),
    geometry2 = /* color: #d63000 */ee.Geometry.Polygon(
        [[[-150.59505433128243, 67.15832511018162],
          [-150.20489769429054, 67.10430817188174],
          [-149.9377636799867, 67.38131693896194],
          [-150.22094031941214, 67.3956873142651]]]),
    geometry3 = /* color: #98ff00 */ee.Geometry.Polygon(
        [[[-111.47683366971046, 65.13812578949556],
          [-114.18496355252296, 63.46901672675555],
          [-114.23440202908546, 63.207739848630744],
          [-113.74001726346046, 63.20278726092272],
          [-110.65285906033546, 65.14505339391035]]]),
    tcc_han = ee.Image("UMD/hansen/global_forest_change_2018_v1_6"),
    tcc_2015 = ee.ImageCollection("users/minfeng/tcc_global_comb"),
    cal_2m_tcc = ee.Image("users/paulmontesano/tte_L7/cal_2010_2015/cal_2m_tcc"),
    landforms_v1 = ee.Image("projects/mangrovescience/boreal/LANDFORMS_TDX90_3_75_500_2000_500"),
    LVIS2017_30m_gte_1p5m = ee.Image("users/mmacander/above_mapping/LVIS/lvis2_30m_above2017_retge_1p5m"),
    geometry4 = /* color: #d63000 */ee.Geometry.Polygon(
        [[[-139.4317688564161, 61.53409428113034],
          [-139.47365423239268, 61.51445128686245],
          [-139.3465499324853, 61.45268252172314],
          [-139.2827667812208, 61.46561746147952]]]),
    LVIS2017_30m_cnt = ee.Image("users/mmacander/above_mapping/LVIS/lvis2_30m_above2017_lvis_pt_cnt"),
    water = ee.Image("JRC/GSW1_0/GlobalSurfaceWater"),
    tte_data_v201906 = ee.Image("projects/mangrovescience/boreal/TTE_DATA_v201906"),
    landforms_v2 = ee.Image("projects/mangrovescience/boreal/LANDFORMS_TDX90_v2_3_75_500_2000_500"),
    tte_data_v201907 = ee.Image("projects/mangrovescience/boreal/TTE_DATA_v201907"),
    hydrob_green_L08 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_gr_lev08_v1c"),
    hydrob_asia_L08 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_as_lev08_v1c"),
    hydrob_asia_L03 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_as_lev03_v1c"),
    hydrob_green_L03 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_gr_lev03_v1c"),
    hydrob_asia_L06 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_as_lev06_v1c"),
    hydrob_green_L06 = ee.FeatureCollection("users/paulmontesano/hydrobasins/hybas_lake_gr_lev06_v1c"),
    gimms3g = ee.ImageCollection("NASA/GIMMS/3GV0"),
    gimms3g_ndvi_trend = ee.Image("users/paulmontesano/gimms3g_gs_ndvi_trend_8km_1982_2012_20deg_trend"),
    landforms_v2_ArcticDEM = ee.Image("projects/mangrovescience/boreal/LANDFORMS_ArcDEM30_v2_3_75_500_2000_500"),
    landsat_ndvi_trend = ee.ImageCollection("projects/mangrovescience/boreal/ABOVE_LANDSAT_NDVI_TREND/ABOVE_LANDSAT_NDVI_TREND"),
    landsat_ndvi_trendsig = ee.ImageCollection("projects/mangrovescience/boreal/ABOVE_LANDSAT_NDVI_TREND/ABOVE_LANDSAT_NDVI_TRENDSIG"),
    tte_data_v201906v2 = ee.Image("projects/mangrovescience/boreal/TTE_DATA_v201906v2"),
    tte_data_v201907v2 = ee.Image("projects/mangrovescience/boreal/TTE_DATA_v201907v2"),
    tte_data_v201902v2 = ee.Image("projects/mangrovescience/boreal/TTE_DATA_v201902v2"),
    GLIHT2014_13m_tree_fcov = ee.Image("users/paulmontesano/airborne/gliht_2014_tree_fcover"),
    GLIHT2018_13m_tree_fcov = ee.Image("users/paulmontesano/airborne/gliht_2018_tree_fcover"),
    LVIS2017_30m_gte_1p37m = ee.Image("users/paulmontesano/airborne/lvis2_30m_above2017_retge_1p37m");
/***** End of imports. If edited, may not auto-convert in the playground. *****/

// TTE AREA ANALYSIS
// TTE VALIDATION WITH LIDAR
// TTE COVAR ANALYSIS (NDVI, PERMAFROST, LANDFORMS)

var fs = require('users/paulmontesano/montesano:mod_forest_structure.js');
var lf = require('users/paulmontesano/montesano:mod_landform.js');
var ndvi_scale_fact = 0.0001;


// WATER MASK
/**** WATER MASKING ****/
var water = water.select('occurrence');
var water_mask = water.unmask(0).lt(75);

var dem = dem.select('elevation')
      //.updateMask(water_mask)
      //.reproject(dem.projection(), null, 30) // whoa - this resulted in aspect calcs that were 180° off...but its the only way to get the ZSTATS_MOSTVULN data output!

var asp = ee.Terrain.aspect(dem);
var slope = ee.Terrain.slope(dem);//.reproject(prj_tcc,null,120);
var hs = ee.Terrain.hillshade(dem,315,25);
//Map.addLayer(hs,{},'hs');

//////////////////////////////////////////////
// Do LANDFORMS, which also returns TPI data
var thresh_slope_flat = 3;
var thresh_tpi = 75;
// These kernel sizes are in meters. When pixels are smaller, more pixels are required to fill kernel, and GEE limits are hit.
// I reduced the kernel by 50% to accomodate calcs with ArcticDEM
var kern_fine = 250;    //500
var kern_coarse = 1000; //2000 is standard
var kern_norm = 250     //500

var tpi_data = lf.do_landform(dem, thresh_slope_flat, thresh_tpi, kern_fine, kern_coarse, kern_norm); // 100, 300, 2000, 500
tpi_data = tpi_data.updateMask(water_mask);
// Hydrobasin work
// https://groups.google.com/forum/#!searchin/google-earth-engine-developers/vector$20to$20raster%7Csort:date/google-earth-engine-developers/ZHgjKqDkKLk/bhpXcS1eDAAJ

//////////////////////////////////////////////
// ASPECT CLASS (eg "slope_faces")
// isFlat=0; isNface=10; isEface=20, isSface=30, isWface=40
var slope_kern_radius = 2;
var asp_class = lf.do_aspect_class(dem, slope_kern_radius, thresh_slope_flat);
//Map.addLayer(asp_class,{min:0, max:40, palette: ['#a19c9c','#0c2c84', '#005a32', '#b10026', '#7a0177']},'asp class', false);

//////////////////////////////////////////////
// Map LANDFORMS
//lf.map_landforms(landforms_plus,'Landforms, classification styled');
//201902- Cal2m in NA, hansen in EU
//201906 - all Cal2m
//201907 - all Hansen
var tte_versions = ["201902", "201906", "201907"];
var tte_versions = ["201902v2"];

for (var k=0; k < tte_versions.length; k++){
  
  var tte_version = tte_versions[k];
  
  if(tte_version == "201902v2"){
    var tte_data_USE = tte_data_v201902v2

  }else if(tte_version == "201906v2"){
    var tte_data_USE = tte_data_v201906v2

  }else if(tte_version == "201907v2"){
    var tte_data_USE = tte_data_v201907v2

  }
  //////////////////////////////////////////////
  // Map NDVI
  // FIX !!! landsat_ndvi_trendsig.mosaic() results in a CONSOLE ERROR
  var landsat_ndvi_trendsig = landsat_ndvi_trendsig.mosaic().updateMask(landsat_ndvi_trendsig.mosaic().abs().lt(10000))
  var landsat_ndvi_trend = landsat_ndvi_trend.mosaic()
  //Map.addLayer(landsat_ndvi_trendsig, {min:-4, max:4, palette: ['#d7191c','#fdae61','#ffffbf','#abdda4','#2b83ba'] }, 'landsat_ndvi_trendsig')
  
  var ndvi_trend_landsat = landsat_ndvi_trend
                                      // include only trends that are significant at p-vals < 0.01
                                      // https://daac.ornl.gov/ABOVE/guides/Vegetation_greenness_trend.html
                                      .updateMask(landsat_ndvi_trendsig.abs().gt(2))
                                      .updateMask(landsat_ndvi_trend.abs().lt(10000))  // gets rid of nodata, water, snow/ice
                                      .multiply(ndvi_scale_fact)
                                      .reproject(tte_data_USE.select(0).projection(), null, 30);
  var do_GIMMS_cloud_mask = function(image){
    var qa =  image.select('qa')
    var good_data = qa.bitwiseAnd(1 << 1).or(qa.bitwiseAnd(1 << 2))
    return image.select('ndvi').updateMask(good_data)
  };
  var ndvi_trend_gimms = gimms3g.map(do_GIMMS_cloud_mask).median()
  //print("GIMMS", ndvi_trend_gimms)
  //////////////////////////////////////////////
  // Modify LANDFORMS w/ ASPECT CLASS & reproject to tcc_data
  // eg: landforms_plus = (asp_class x 10) + landforms
  
    ///////////////////////////////////////
  // LANDFORMS
  var pal_land = ['#9e0142','#d53e4f','#f46d43','#fdae61','#fee08b','#5e982a','#abdda4','#66c2a5','#3288bd','#5e4fa2'].reverse();
  var pal_land_unclass = ['#000000'].concat(pal_land)
  var pal_land_NESW = pal_land_unclass.concat(pal_land).concat(pal_land).concat(pal_land).concat(pal_land);
  //Map.addLayer(landforms.updateMask(tte_data_USE.select('tte_domain')), {min: 0, max: 50, palette: pal_land_NESW}, 'Landforms (no aspect class)', false);
  // Landforms_v1 has spect class, but possiby wrong, b/c not multiplied by 10; has an asset name indicating min slope for flat, kern sizez, etc
  //Map.addLayer(landforms_v2.updateMask(tte_data_USE.select('tte_domain')), {min: 0, max: 50, palette: pal_land_NESW}, 'Landforms v2 (aspect class, no palette)', false);
  // Landforms_v2 has aspect class

  var landforms_plus = asp_class
                              .multiply(10)
                              .add(tpi_data.select('tpi_landforms'))
                              .reproject(tte_data_USE.select(0).projection(), null, 30);
  var l = require('users/paulmontesano/montesano:mod_landform.js');
  //l.map_landforms(landforms_plus,'Landforms (aspect class styled)');
                              
  //  Tree Cover Datasets
  //---> Hansen TCC (Hansen et al)
  //TCC
  var tcc_han_2000 = tcc_han.select(['treecover2000'])
  // Loss
  var loss_han_2000 = tcc_han.select(['loss'])
  loss_han_2000 = loss_han_2000.updateMask(loss_han_2000.eq(1))
  // Loss Year
  var lossyr_han = tcc_han.select(['lossyear'])
  lossyr_han = lossyr_han.updateMask(lossyr_han.gt(1))
  
  // Min Feng 2015
  // Calibrated 2m boreal
  
  // Set TCC Mask: pixel values
  var cal_2m_tcc_mask = cal_2m_tcc.where(cal_2m_tcc.gt(100),0)//.updateMask(cal_2m_tcc.lte(100).and(cal_2m_tcc.gte(0)));                                                                // CHANGE TO updateMask !!!!
  var tcc_2015_mask = tcc_2015//.updateMask(tcc_2015.lte(100).and(tcc_2015.gte(0)));
  
  //////////////////////////////////////////////
  // Factors to ADD/CONSIDER:
  // PERMAFROST: Get PERMAFROST PROBABILITY from Obu et al 2018 : https://doi.pangaea.de/10.1594/PANGAEA.888600
  //Map.addLayer(permprob, {min: 0, max: 0.999, palette: ['#a6611a','#dfc27d','#ffffbf','#abd9e9','#2c7bb6']}, 'Permafrost Prob', false)
  // SOIL WATER: Get TPI (TDX 90m)
  // OTHER VEGETATION: Get shrub cover?
  // DISTURBANCE FREQUENCY?
  // WorldClim BioClim: Mean Tmp Warmest Qrt
  var clim_envelope = bio2.select('bio_10')//.reproject(proj_cal_2m.atScale(500)); //Tavg_30s_july
  var clim_min = 7
  var clim_max = 14
  clim_envelope = clim_envelope.mask(clim_envelope.gt(clim_min).and(clim_envelope.lt(clim_max)));
  
  /*
  The Extent and Pattern of the Circumpolar Biome Boundary: The Taiga-Tundra Ecotone
  */
  var wwf_tte_img = ee.Image().byte().paint(ecoregions, 'ECO_NUM');
  //Map.addLayer(wwf_tte_img.randomVisualizer(), {}, 'ECO_NUM', false)
  /*
  TTE Bioclimatic Domain
    -This domain provides a climatic (coarse scale) lens in which the current TTE biome boundary lies;
    -It suggests, based on modelled data, where climate conditions could support some level of tree cover if none currently exists;
    - It is a mask that combines:
      [1] a mean temp. of the warmest quarter ranging from 7°C - 14°C
      [2] WWF Ecoregion
      also, where TCC relative error is NOT nodata  --> ask Min to fix TCC RelErr 'nodata' area in far eastern siberia
  */
  Map.addLayer(tte_data_USE.select('tte_domain'), {min:0, max:1, palette: ['#6a6a6a']}, 'TTE Bioclimatic Domain', false);
  
  /*
  TTE Tree Canopy Cover
  */
  var tcc_viz = {min: 0, max: 50, palette: ['#8c510a','#d9f0a3','#addd8e','#78c679','#41ab5d','#238443','#005a32']};
  Map.addLayer(tcc_han_2000.mask(tcc_han_2000), tcc_viz, 'Hansen 2000 Tree Cover (self mask)', false);
  Map.addLayer(tcc_2015_mask, tcc_viz, 'Feng 2015 Tree Cover', false);
  Map.addLayer(cal_2m_tcc_mask.mask(cal_2m_tcc_mask), tcc_viz, 'Boreal Cal2m Tree Cover (self mask)', false);
  Map.addLayer(tte_data_USE.select('tcc'), tcc_viz, 'TTE USE Tree Cover', false); //Cal.2m.2010-2015 in NA, Han2000 in EU
  //Map.addLayer(tte_data_USE.select('tcc_spat_rate_chg'), {min: 0, max: 90, palette: ['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026']}, 'TTE USE Spat Rate Chnge in Tree Cover', false)
  Map.addLayer(loss_han_2000, {min: 1, max: 1, palette: ['red']},  'Hansen Loss of Tree Cover', false);
  /*
  Circumpolar TTE Zones (the extent of different canopy cover and relative error rannges)
      Derived from TCC estimates (excluding vast areas where TCC = 0 AND Abruptness = 0, which is meaningless):
        [1] Calibrated 2m TCC (Montesano et al. & Sexton et al.) used within the TTE DOMAIN of N.America and Eurasian west of Yenesei R. (generally, non-permafrost larch areas) 
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
  var tte_data_zones_viz = {min: 1, max: 4, palette: ['#fc8d59','#ffffbf','#91cf60','#1a9641']};
  var tte_data_zones_viz = {min: 1, max: 4, palette:['#d7191c','#ffffbf','#a6d96a','#1a9641']};
  var tte_data_zones_viz = {min: 1, max: 4, palette: ['#fc8d59','#ffffbf','#91cf60','#cccccc']};
  Map.addLayer(tte_data_USE.select('tte_zones'), tte_data_zones_viz, "TTE Zones "+tte_version, false);                                 
  /*
  Circumpolar TTE Abruptness (the normalized difference spatial rate of chance in tree cover within TTE Zones)
  */
  var tte_data_abruptness_viz = {min: -1, max: 1, palette: ['#d7191c','#fdae61','#ffffbf','#abdda4','#2b83ba'].reverse()};
  Map.addLayer(tte_data_USE.select('tte_abruptness'), tte_data_abruptness_viz, "TTE Abruptness "+tte_version, false); 
  /*
  Circumpolar TTE Classification (based on the spatial rate of change in tree cover within TTE Zones)
  */
  //var tte_data_class_viz = {min:1, max:9, palette: ['#5255a3','#1796a3','#fdae61','#d7191c','#ffffbf','#d9ef8b','#91cf60','#1a9850','gray']};
  var tte_class_pal = ['#5255a3','#1796a3','#fdbf6f','#ff7f00', //sparse
                       '#ffffbf','#d9ef8b','#91cf60','#1a9850', //open
                       '#c4c4c4','red', 'blue'];                //Intermediate w/ high rel err; leading edge non-water; leading edge water
  var tte_data_class_viz = {min:1, max:11, palette: tte_class_pal};                    
  Map.addLayer(tte_data_USE.select('tte_classification'), tte_data_class_viz, "TTE Classification "+tte_version, false); 
  //print(tte_data_USE.select('tte_classification'))
  
    ////////////////////////////////////////
    // LVIS 2017
    // masking: removing pixels where n is less than 12
    LVIS2017_30m_gte_1p37m = LVIS2017_30m_gte_1p37m.updateMask(LVIS2017_30m_cnt.gte(12));
    
    Map.addLayer(LVIS2017_30m_gte_1p37m, tcc_viz, 'LVIS TCC', false);
    var tcc_lvis = fs.get_abruptness(LVIS2017_30m_gte_1p37m);
    tcc_lvis = tcc_lvis.updateMask(tcc_lvis.select('tcc').gte(0)
                .and(tcc_lvis.select('tcc_abruptness').abs().gt(0)) );
    var mask_abrupt = tcc_lvis.select('tcc').gte(0)                               // condition 1: TCC
                      .and(tcc_lvis.select('tcc_abruptness').abs().gt(0));         // condition 2: Abruptness
    tcc_lvis = tcc_lvis.updateMask(mask_abrupt);
    var tcc_lvis_abruptness = tcc_lvis.select('tcc_abruptness');
    Map.addLayer(tcc_lvis_abruptness,tte_data_abruptness_viz, 'LVIS TCC Abruptness', false);
    
    ///////////////////////////////////////
    // GLiHT 2014 CHM
    var chm_pal = {min: 0.0, max: 330, palette: ['#636363','#fc8d59','#fee08b','#ffffbf','#d9ef8b','#91cf60','#1a9850']};
    var chm_gliht = fs.get_abruptness(GLIHT_CHM_5m);
    chm_gliht = chm_gliht.select([0,1,2],['chm', 'chm_spat_rate_chg', 'chm_abruptness']);
    Map.addLayer(chm_gliht.select(0),chm_pal, 'GLiHT 2014 CHM', false);
    Map.addLayer(chm_gliht.select(2),tte_data_abruptness_viz, 'GLiHT 2014 CHM Abruptness', false);
    
    ///////////////////////////////////////
    // GLiHT 2014
    var GLIHT2014 = GLIHT2014_13m_tree_fcov.multiply(100).clip(ee.Feature(GLIHT2014_13m_tree_fcov).bounds()); //re-scale
    var tcc_gliht2014 = fs.get_abruptness(GLIHT2014);
    tcc_gliht2014 = tcc_gliht2014.select([0,1,2],['tcc', 'tcc_spat_rate_chg', 'tcc_abruptness']);
    Map.addLayer(tcc_gliht2014.select(0),tcc_viz, 'GLiHT 2014 TCC', false);
    Map.addLayer(tcc_gliht2014.select(2),tte_data_abruptness_viz, 'GLiHT 2014 TCC Abruptness', false);
    
    ///////////////////////////////////////
    // GLiHT 2018
    var GLIHT2018 = GLIHT2018_13m_tree_fcov.multiply(100).clip(ee.Feature(GLIHT2018_13m_tree_fcov).bounds()); //re-scale
    var tcc_gliht2018 = fs.get_abruptness(GLIHT2018);
    tcc_gliht2018 = tcc_gliht2018.select([0,1,2],['tcc', 'tcc_spat_rate_chg', 'tcc_abruptness']);
    Map.addLayer(tcc_gliht2018.select(0),tcc_viz, 'GLiHT 2018 TCC', false);
    Map.addLayer(tcc_gliht2018.select(2),tte_data_abruptness_viz, 'GLiHT 2018 TCC Abruptness', false);
    
    ///////////////////////////////////////
    // GLiHT MOSAIC
    //var tcc_glihtmos = tcc_gliht2018.add(tcc_gliht2014)
    var GLIHTmos = ee.ImageCollection([GLIHT2018, GLIHT2014]).mosaic();
    //print(GLIHTmos)
    var tcc_glihtmos = fs.get_abruptness(GLIHTmos);
    
    ///////////////////////////////////////
    // GLOBAL FOREST HEIGHT
    var pal_height = ['#d73027','#fc8d59','#fee08b','#ffffbf','#d9ef8b','#91cf60','#1a9850'];
    var height_viz = {min:6, max:25, palette: pal_height};
    Map.addLayer(forest_ht.updateMask(forest_ht.gte(6)).clip(bioclim_envelope).clip(ecoregion_extent), height_viz, 'Global Height', false);
  
  ///////////////////////////////////////
  // 
  
  /*
  ##################
  NUMBERS!!!
  ##################
  */
  var add_lat_lon_fields = function(f) {
    // Get centroid components
      return f.set('cent_lat', f.centroid().geometry().coordinates().get(1))
              .set('cent_lon', f.centroid().geometry().coordinates().get(0));
  };
  /////////////////////////////////////////////////////////////////
  // ECOREGIONS
  //
  var eco_NA = ee.FeatureCollection(ecoregions.filter(ee.Filter.stringContains('REALM', 'NA')));
  var eco_EU = ee.FeatureCollection(ecoregions.filter(ee.Filter.stringContains('REALM', 'PA')));
  ecoregions = eco_NA.merge(eco_EU)//.filter(ee.Filter.greaterThan('AREA',1000))
               .filterBounds(ee.FeatureCollection(na_region).merge(ee.FeatureCollection(eu_region))); 
  //Map.addLayer(ecoregions, {}, 'Ecoregions', false)
  Map.addLayer(ecoregion_extent,  {min:1, max:1, palette:"#0ea721"}, "Ecoregion Extent vector", false)
  Map.addLayer(bioclim_envelope,  {min:1, max:1, palette:"#9f4ac2"}, "Bioclim Envelope vector", false)
  
  
  /////////////////////////////////////////////////////////////////
  //
  // OUTPUTS TO DRIVE
  //
  ////////////////////////////////////////////////////////////////
  var out_table_folder_name = "TTE_map_v"+tte_version
  
  /////////////////////////////////////////////////////////////////
  // HYDROBASINS 
  // L02/L03 - should be ok for area totals
  // Empty polygons can cause problems, and there are many empty L06 polys but no empty L02 polys
  var hydrob_L03_CIRC = ee.FeatureCollection(hydrob_eu_L03.merge(hydrob_arc_L03).merge(hydrob_sib_L03).merge(hydrob_na_L03).merge(hydrob_asia_L03).merge(hydrob_green_L03))
                      //.filterBounds(ee.FeatureCollection(na_region).merge(ee.FeatureCollection(eu_region)))
                                            .filterBounds(bioclim_envelope)
                                            .filterBounds(ecoregion_extent);
  
  // Clean
  var hydrob_L03_CIRC = hydrob_L03_CIRC.map(fs.clean_polygon_feature);
  hydrob_L03_CIRC = hydrob_L03_CIRC.map(add_lat_lon_fields);
  
  Export.table.toDrive({
    folder: out_table_folder_name,
    collection: hydrob_L03_CIRC,
    description: 'hydrob_L03_CIRC',
    fileNamePrefix: 'hydrob_L03_CIRC',
    fileFormat: 'SHP' 
  });
  // L06
  var hydrob_L06_CIRC = ee.FeatureCollection(hydrob_eu_L06.merge(hydrob_arc_L06).merge(hydrob_sib_L06).merge(hydrob_na_L06).merge(hydrob_asia_L06).merge(hydrob_green_L06))
                                            .filterBounds(bioclim_envelope)
                                            .filterBounds(ecoregion_extent);
  
  // Clean
  var hydrob_L06_CIRC = hydrob_L06_CIRC.map(fs.clean_polygon_feature);
  hydrob_L06_CIRC = hydrob_L06_CIRC.map(add_lat_lon_fields);
  
  Export.table.toDrive({
    folder: out_table_folder_name,
    collection: hydrob_L06_CIRC,
    description: 'hydrob_L06_CIRC',
    fileNamePrefix: 'hydrob_L06_CIRC',
    fileFormat: 'SHP'
  });
  Map.addLayer(hydrob_L06_CIRC, {}, 'L06 Hydrobasins', false);
  // L08
  var hydrob_L08_CIRC = ee.FeatureCollection(hydrob_eu_L08.merge(hydrob_arc_L08).merge(hydrob_sib_L08).merge(hydrob_na_L08).merge(hydrob_asia_L08).merge(hydrob_green_L08))
                                            .filterBounds(bioclim_envelope)
                                            .filterBounds(ecoregion_extent);
  // split up L08 data (too big)
  var hydrob_L08_NA = ee.FeatureCollection(hydrob_na_L08.merge(hydrob_arc_L08).merge(hydrob_green_L08))
                                            .filterBounds(bioclim_envelope).filterBounds(ecoregion_extent)
                                            .map(add_lat_lon_fields);
  var hydrob_L08_EU = ee.FeatureCollection(hydrob_eu_L08.merge(hydrob_sib_L08).merge(hydrob_asia_L08))
                                            .filterBounds(bioclim_envelope).filterBounds(ecoregion_extent)
                                            .map(add_lat_lon_fields);
  // Clean
  hydrob_L08_CIRC = hydrob_L08_CIRC.map(fs.clean_polygon_feature);
  hydrob_L08_CIRC = hydrob_L08_CIRC.map(add_lat_lon_fields);
  
  
  Export.table.toDrive({
    folder: out_table_folder_name,
    collection: hydrob_L08_NA,
    description: 'hydrob_L08_NA',
    fileNamePrefix: 'hydrob_L08_NA',
    fileFormat: 'SHP'//CSV
  });
  Map.addLayer(hydrob_L08_NA, {}, 'L08 Hydrobasins in NA', false);
  Export.table.toDrive({
    folder: out_table_folder_name,
    collection: hydrob_L08_EU,
    description: 'hydrob_L08_EU',
    fileNamePrefix: 'hydrob_L08_EU',
    fileFormat: 'SHP'//CSV
  });
  Map.addLayer(hydrob_L08_EU, {}, 'L08 Hydrobasins in EU', false);
  
  
  var hydroname = 'L08'
  var realm = 'EU'//'CIRC'//'EU_AGU' //'EU' // NA
  
  if (realm == 'EU') {var smry_fc = hydrob_L08_EU;} else {var smry_fc = hydrob_L08_NA;}
  
  //hydrob_L08_NA//hydrob_L08_CIRC//ecoregions;
  Map.addLayer(smry_fc, {}, 'Circumpolar Hydrobasins for smry', false) //.filter(ee.Filter.eq('HYBAS_ID', 2030016230))
  var res = 30;
  
/*HANDLED IN LOOP BELOW  
  print("TTE ZONES: Area of ZONES per HYDROBASIN; CIRCUMPOLAR (Leading Edge, Sparse, Open)")
  fs.get_area_export(tte_data_USE.select('tte_zones'), smry_fc, res, 'tte_zones_'+realm+'_'+hydroname, true, out_table_folder_name)
  
  print("TTE CLASSIFICATION: AREA of CLASS per HYDROBASIN; CIRCUMPOLAR")
  fs.get_area_export(tte_data_USE.select('tte_classification'), smry_fc, res, 'tte_class_'+realm+'_'+hydroname, true, out_table_folder_name); //hydrob_L06_CIRC
  
  print("TTE DOMAIN: AREA of TTE BIOCLIM ENVELOPE per HYDROBASIN; CIRCUMPOLAR")
  fs.get_area_export(tte_data_USE.select('tte_domain'), smry_fc, res, 'tte_envelope_'+realm+'_'+hydroname, true, out_table_folder_name); //hydrob_L06_CIRC
*/
  

  
  
  ///////////////////////////////////////////////////////////
  //
  // HISTOGRAMS with CoVars; mapped over L03 or L06 HydroBasins?
  // https://code.earthengine.google.com/000f13069bd85bff25c35e2f15496416
  //
  var res_stats = 30;
  ///////////////////////////////////////////////////////////
  // Get TTE input images that will be crossed with CoVars
  var tte_zone_sparse = tte_data_USE.select('tte_zones').mask(tte_data_USE.select('tte_zones').eq(1));
  var tte_zone_open = tte_data_USE.select('tte_zones').mask(tte_data_USE.select('tte_zones').eq(2));
  // True Sparse: modify Sparse by including only TCC>0?
  var tte_zone_sparse_true = tte_zone_sparse.updateMask(tte_data_USE.select('tcc').gt(0));
  var tte_leading_edge = tte_zone_sparse.mask(tte_data_USE.select('tte_abruptness').eq(1));
  
  /*
  // Function to get histogram of CoVar distrib for TTE Zone
  var do_hist_TTE_X_covar = function(img, bname, res, bin, geom, title){
    // 1st method
    //var histogram = ui.Chart.image.histogram({image: img, region: geom, scale: scale, minBucketWidth: bin});
    
    // 2nd method
    var histogram = img.reduceRegion({
              reducer: ee.Reducer.histogram(),
              geometry: geom,
              scale: img.projection().nominalScale(), //res
              maxPixels: 1e13
              });
    var h = ee.Dictionary(histogram.get(bname)).get('histogram')
    var x = ee.Dictionary(histogram.get(bname)).get('bucketMeans')
    x = ee.List(x).map(function(v) {return ee.String(v)})
    var hist = ui.Chart.array.values(h, 0, x)
                    .setChartType('ColumnChart')
                    .setOptions({ title: title});
    //print("Histogram from do_hist_TTE_X_covar:", histogram)
    return hist;
  };*/
  
  
  // ZSTATS: exporting zonal stats for all hydrobasins (count, min, max, mean median, stdev); failed trying actual histograms per zone, so settling for just stats.
  // helpful for binning? https://code.earthengine.google.com/8cfc76c077325ab6d2a24c9edf3a9137
  // snippet from here: Zonal Histogram --> https://code.earthengine.google.com/ce03abbe4f459b1835bd9e4f1e841a3f
  // snippet for simpler: Zonal Means --> https://code.earthengine.google.com/8791f5fd45830fec470fd06349ae1eae
  // snippet for reformatting outout: --> https://code.earthengine.google.com/832a74e4d2eeacc6dab44f7a58eec8eb
  /////////////////////////////////////////////////////////////////
  // TTE ZONES x PERM PROB
  ////////////////////
  /*var covar_name = "Permafrost Prob"; 
  var tte_zone_sparse_true_perm = permprob.updateMask(tte_zone_sparse_true);
  var tte_leading_edge_perm = permprob.updateMask(tte_leading_edge);
  var tte_zone_open_perm = permprob.updateMask(tte_zone_open);
  
  var ZSTATS = fs.get_zonalstats_export(tte_zone_sparse_true_perm, smry_fc, res_stats, 'tte_zone_sparse_true_perm_'+realm+'_'+hydroname, out_table_folder_name);
  var ZSTATS = fs.get_zonalstats_export(tte_leading_edge_perm, smry_fc, res_stats, 'tte_leading_edge_perm_'+realm+'_'+hydroname, out_table_folder_name);
  var ZSTATS = fs.get_zonalstats_export(tte_zone_open_perm, smry_fc, res_stats, 'tte_zone_open_perm_'+realm+'_'+hydroname, out_table_folder_name);
  */
  
  /*print(do_hist_TTE_X_covar(tte_leading_edge_perm, 'b1',res_stats, 0.01, bioclim_envelope.filterBounds(ecoregion_extent), covar_name + ': Lead Edge' ));
  print(do_hist_TTE_X_covar(tte_zone_sparse_true_perm, 'b1',res_stats, 0.01, bioclim_envelope.filterBounds(ecoregion_extent), covar_name + ': Sparse (1-5%)' ));
  print(do_hist_TTE_X_covar(tte_zone_open_perm, 'b1',res_stats, 0.01, bioclim_envelope.filterBounds(ecoregion_extent), covar_name + ': Open (6-30%)' ));
  //Map.addLayer(tte_zone_open_perm, {min: 0, max: 100}, 'TTE Open X Perm Prob');
  */
  /////////////////////////////////////////////////////////////////
  // TTE ZONES x CLIM
  // using "clim_envelope" is ok, b/c it provides convenient 
  ////////////////////
  var covar_name = "Mean Tmp Wrm Qrt"; 
  var tte_zone_sparse_true_clim = clim_envelope.updateMask(tte_zone_sparse_true);
  var tte_leading_edge_clim = clim_envelope.updateMask(tte_leading_edge);
  var tte_zone_open_clim = clim_envelope.updateMask(tte_zone_open);
  /*
  var ZSTATS = fs.get_zonalstats_export(tte_zone_sparse_true_clim, smry_fc, res_stats, 'tte_zone_sparse_true_clim_'+realm+'_'+hydroname, out_table_folder_name);
  var ZSTATS = fs.get_zonalstats_export(tte_leading_edge_clim, smry_fc, res_stats, 'tte_leading_edge_clim_'+realm+'_'+hydroname, out_table_folder_name);
  var ZSTATS = fs.get_zonalstats_export(tte_zone_open_clim, smry_fc, res_stats, 'tte_zone_open_clim_'+realm+'_'+hydroname, out_table_folder_name);
  
  // cant get output reformat to work in function
  var ZHIST = fs.get_zonalhist_export(tte_zone_sparse_true_clim, hydrob_L06_CIRC, res_stats, 'tte_zone_sparse_true_clim', out_table_folder_name);
  var ZHIST = fs.get_zonalhist_export(tte_leading_edge_clim, hydrob_L06_CIRC, res_stats, 'tte_leading_edge_clim', out_table_folder_name);
  var ZHIST = fs.get_zonalhist_export(tte_zone_open_clim, hydrob_L06_CIRC, res_stats, 'tte_zone_open_clim', out_table_folder_name);
  */
  /*
  //Shows 1 histogram of CLIM across all hydrosheds - not good enough
  print(do_hist_TTE_X_covar(tte_leading_edge_clim,'bio_10', res_stats, 0.25, bioclim_envelope.filterBounds(ecoregion_extent), covar_name + ': Lead Edge' ));
  print(do_hist_TTE_X_covar(tte_zone_sparse_true_clim, 'bio_10', res_stats, 0.25, bioclim_envelope.filterBounds(ecoregion_extent), covar_name + ': Sparse (1-5%)' ));
  print(do_hist_TTE_X_covar(tte_zone_open_clim, 'bio_10', res_stats, 0.25, bioclim_envelope.filterBounds(ecoregion_extent), covar_name + ': Open (6-30%)' ));
  //
  */
  Map.addLayer(tte_leading_edge_clim, {min: clim_min, max: clim_max}, 'TTE lead X Clim', false);
  
  /////////////////////////////////////////////////////////////////
  // TTE ZONES x LANDFORMS (v2, with aspect class)
  ////////////////////
  
  // Intersect TTE pattern layer of interest with landforms (mask landforms with TPI to remove bad data)
  var covar_name = "Landform Class"; 
  var tte_zone_sparse_true_landforms = landforms_plus.updateMask(tte_zone_sparse_true);
  var tte_leading_edge_landforms = landforms_plus.updateMask(tte_leading_edge);
  var tte_zone_open_landforms = landforms_plus.updateMask(tte_zone_open);
  /*
  var ZSTATS = fs.get_zonalstats_export(tte_zone_sparse_true_landforms, smry_fc, res_stats, 'tte_zone_sparse_true_landforms_'+realm+'_'+hydroname, out_table_folder_name);
  var ZSTATS = fs.get_zonalstats_export(tte_leading_edge_landforms, smry_fc, res_stats, 'tte_leading_edge_landforms_'+realm+'_'+hydroname, out_table_folder_name);
  var ZSTATS = fs.get_zonalstats_export(tte_zone_open_landforms, smry_fc, res_stats, 'tte_zone_open_landforms_'+realm+'_'+hydroname, out_table_folder_name);
  */

  
  
  // maybe try to get MODE for the thematic 'Landforms'?
  
  
  /*print(do_hist_TTE_X_covar(tte_leading_edge_landforms,'constant', res_hist, 1, bioclim_envelope.filterBounds(ecoregion_extent), covar_name + ': Lead Edge' ));
  print(do_hist_TTE_X_covar(tte_zone_sparse_true_landforms, 'constant',res_hist, 1, bioclim_envelope.filterBounds(ecoregion_extent), covar_name + ': Sparse (1-5%)' ));
  print(do_hist_TTE_X_covar(tte_zone_open_landforms, 'constant', res_hist, 1, bioclim_envelope.filterBounds(ecoregion_extent), covar_name + ': Open (6-30%)' ));
  */
  
  //lf.map_landforms(tte_leading_edge_landforms,'TTE LE X Landforms')
  //Map.addLayer(tte_leading_edge_landforms, {min: 0, max: 410, palette: pal_land_NESW}, 'TTE LE X Landforms');
  
  /////////////////////////////////////////////////////////////////
  // MOST VULNERABLE to structural change from warming?
  // Lead Edge with: (1) non-water Adjacent, (2) warm (mean TMP > 11°C), (3) plains (Landforms class 5) 
  ////////////////////
  var MOSTVULN_tte_leading_edge_NORTHFACE = landforms_plus.updateMask(tte_leading_edge)
                                  .updateMask(tte_data_USE.select('tte_classification').eq(10))// not-water-adjacent
                                  .updateMask(clim_envelope.gt(10))                            // warm portion
                                  .updateMask(landforms_plus.gt(100).and(landforms_v2.lt(200)))  // northFaces
                                  //.reproject(tte_leading_edge.projection(), null, res)
  
  var MOSTVULN_tte_leading_edge_SOUTHFACE = landforms_plus.updateMask(tte_leading_edge)
                                  .updateMask(tte_data_USE.select('tte_classification').eq(10))// not-water-adjacent
                                  .updateMask(clim_envelope.gt(10))                            // warm portion
                                  .updateMask(landforms_plus.gt(300).and(landforms_v2.lt(400)))  // southFaces
                                  //.reproject(tte_leading_edge.projection(), null, res)
  //print("CHECK", MOSTVULN_tte_leading_edge_SOUTHFACE)
  //print("Histograms for MOSTVULN_tte_leading_edge_SOUTHFACE", tte_version, do_hist_TTE_X_covar(MOSTVULN_tte_leading_edge_SOUTHFACE,'bio_10', res_stats, 0.25, bioclim_envelope.filterBounds(ecoregion_extent), covar_name + ': Lead Edge' ));
  Map.addLayer(MOSTVULN_tte_leading_edge_SOUTHFACE, {palette:"red"}, "MOSTVULN_tte_leading_edge_SOUTHFACE", false)
  
  var MOSTVULN_tte_leading_edge_FLAT = landforms_plus.updateMask(tte_leading_edge)
                                  .updateMask(tte_data_USE.select('tte_classification').eq(10))// not-water-adjacent
                                  .updateMask(clim_envelope.gt(10))                            // warm portion
                                  .updateMask(landforms_plus.eq(5))                              // plains
                                  //.reproject(tte_leading_edge.projection(), null, res)
  //print("CHECK", MOSTVULN_tte_leading_edge_FLAT)
  //print("Histograms for MOSTVULN_tte_leading_edge_FLAT", tte_version, do_hist_TTE_X_covar(MOSTVULN_tte_leading_edge_FLAT,'bio_10', res_stats, 0.25, bioclim_envelope.filterBounds(ecoregion_extent), covar_name + ': Lead Edge' ));
  Map.addLayer(MOSTVULN_tte_leading_edge_FLAT, {palette:"purple"}, "MOSTVULN_tte_leading_edge_FLAT", false)
 
  var MOSTVULN_tte_zone_sparse_true_NORTHFACE = landforms_plus.updateMask(tte_zone_sparse_true)
                                  .updateMask(clim_envelope.gt(10))                            // warm portion
                                  .updateMask(landforms_plus.gt(100).and(landforms_plus.lt(200)))  // southFaces
                                  //.reproject(tte_zone_sparse_true.projection(), null, res)  
  var MOSTVULN_tte_zone_sparse_true_SOUTHFACE = landforms_plus.updateMask(tte_zone_sparse_true)
                                  .updateMask(clim_envelope.gt(10))                            // warm portion
                                  .updateMask(landforms_plus.gt(300).and(landforms_plus.lt(400)))  // southFaces
                                  //.reproject(tte_zone_sparse_true.projection(), null, res)
  //Map.addLayer(MOSTVULN_tte_zone_sparse_true_SOUTHFACE, {palette:"orange"}, "MOSTVULN_tte_zone_sparse_true_SOUTHFACE", true) 

  var MOSTVULN_tte_zone_sparse_true_FLAT = landforms_plus.updateMask(tte_zone_sparse_true)
                                  .updateMask(clim_envelope.gt(10))                            // warm portion
                                  .updateMask(landforms_plus.eq(5))                              // plains
                                  //.reproject(tte_zone_sparse_true.projection(), null, res)

  
  /////////////////////////////////////////////////////////////////
  // MAP
  //Map.addLayer(QB_val_pts, {}, 'QB val pts');
  Map.addLayer(LVIS2017, {}, 'LVIS lines', false);
  Map.addLayer(plots, {}, 'plots', false);
  Map.addLayer(hydrob_L08_CIRC.filterBounds(cavm), {}, 'L08 basins at CAVM', false)
  Map.addLayer(cavm, {}, 'CAVM treeline', false);
  
  var resDrive = 500;
  var na_box = ee.Geometry.Rectangle([-180, 45, -40, 75], null, false)
  var eu_box = ee.Geometry.Rectangle([-22, 45, 180, 75], null, false)
  var circ_box = ee.Geometry.Rectangle([-180, 45, 180, 75], null, false)
  var polar_stereo_wkt = 'PROJCS["unnamed",'+
            'GEOGCS["unnamed ellipse",'+
              'DATUM["unknown",'+
                  'SPHEROID["unnamed",6378273,298.279411123064]],'+
                    'PRIMEM["Greenwich",0],'+
                    'UNIT["degree",0.0174532925199433]],'+
                    'PROJECTION["Polar_Stereographic"],'+
                    'PARAMETER["latitude_of_origin",90],'+
                    'PARAMETER["central_meridian",0],'+
                    'PARAMETER["scale_factor",1],'+
                    'PARAMETER["false_easting",0],'+
                    'PARAMETER["false_northing",0],'+
                    'UNIT["Meter",1]]'
  Export.image.toDrive({
    image: tte_data_USE.select('tte_zones').int8(), 
    description: 'tte_data_v'+tte_version+'_zones_'+resDrive+'m', 
    folder: out_table_folder_name, 
    scale: resDrive,
    crs: 'EPSG:4326', //polar_stereo_wkt
    region: circ_box,
    maxPixels: 1e13,
    shardSize:256,
    fileDimensions:[40960,40960],
    skipEmptyTiles: false
  });
  
  //////////////////////////////////////////////////
  // Validation of TTE TCC with LVIS, GLiHT
  //
  /////////////////////////////////////////////////
  print("TTE data for SAMPLES stack lidar val",tte_data_USE)
  var stack_lvis2017_landsat   = fs.do_tcc_sampling(tte_data_USE, tcc_lvis, landforms_v2, 30, 'lvis2017','landsat', out_table_folder_name, true)
  var stack_gliht2014_landsat  = fs.do_tcc_sampling(tte_data_USE, tcc_gliht2014, landforms_v2, 30, 'gliht2014','landsat', out_table_folder_name, true)
  var stack_gliht2018_landsat  = fs.do_tcc_sampling(tte_data_USE, tcc_gliht2018, landforms_v2, 30, 'gliht2018','landsat', out_table_folder_name, true)
  var stack_gliht2014_lvis2017 = fs.do_tcc_sampling(tcc_lvis, tcc_gliht2014, landforms_v2, 30, 'gliht2014','lvis2017', out_table_folder_name, false)
  print("SAMPLES stack lidar val",stack_gliht2014_lvis2017)
  // TABLE: (ZPEARSONS) Pearson's per L08 hydrobasin
  res = 30
  // ---OK...fix this--go back to 2 band stack using 1st run, 2nd run technique below
  var ZPEARS_fc = fs.get_zonalpearsons_export(stack_lvis2017_landsat, hydrob_L08_CIRC.filterBounds(LVIS2017), res, 'stack_val_LVIS2017_L08', out_table_folder_name);
  var ZPEARS_fc = fs.get_zonalpearsons_export(stack_gliht2018_landsat, hydrob_L08_CIRC.filterBounds(LVIS2017), res, 'stack_val_GLIHT2018_L08', out_table_folder_name);
  
  /*
  // 1st run: TCC (run this to get the ZPEARS_fc that will go into the 2nd export)
  var ZPEARS_fc = fs.get_zonalpearsons_export(tcc_lvis2017_landsat, hydrob_L08_CIRC.filterBounds(LVIS2017), res, 'NOT NEEDED tte_lvis2017_landsat_L08', out_table_folder_name);
  // 2nd run: Abruptness (the exported table will have the correlation of TCC from above with that of Abruptness appended to it)
  var ZPEARS_fc = fs.get_zonalpearsons_export(abruptness_lvis_landsat, ZPEARS_fc, res, 'validation_LVIS2017_L08', out_table_folder_name);
  */
  
  // Sample the stack
  // Get export CSV for R
  var SAMPLES_stack_ndvi_landforms_tte = tte_data_USE
                    .addBands(landforms_plus.updateMask(tte_data_USE.select("tte_classification")))
                    .addBands(ndvi_trend_landsat.updateMask(tte_data_USE.select("tte_classification")))
                        .sample({
                                  numPixels: 10000,
                                  tileScale:3,
                                  projection: tte_data_USE.select(0).projection(),
                                  scale: 30, 
                                  geometries: false
                                });
    Export.table.toDrive({
    folder: out_table_folder_name,
    collection: SAMPLES_stack_ndvi_landforms_tte,
    description: 'SAMPLES_stack_ndvi_landforms_tte_'+tte_version,
    fileNamePrefix: 'SAMPLES_stack_ndvi_landforms_tte_'+tte_version,
    fileFormat: 'CSV'
  });
  /////////////////////////////////////////////////////////
  // Validation of TCC with Eurasia plots & QB val points
  //
  // Mean image values at points
  ///////////////////////////////////////////////////////////
  // Eurasia plots: Defining a buffers around each point
  var buf_sz_plots = 5;
  var plot_buf= function(plots) {return plots.buffer(buf_sz_plots)};
  var plot_circles= plots.map(plot_buf);
  
  // QB val points: Defining a buffers around each point
  var buf_sz_QB = 5;
  var QB_val_pts_buf= function(QB_val_pts) {return QB_val_pts.buffer(buf_sz_QB)};
  var QB_val_pts_circles= QB_val_pts.map(QB_val_pts_buf);
  
/*  // Get for eurasia plots
  var SAMPLE_TCC_plotsEUR = fs.get_region_mean(tte_data_USE.select('tcc'), plot_circles)
                              .map(function(feature) {
                                return ee.Feature(feature.select(['lat','lon','site','year','mean','image_id'], null, false));
                              });

  // Get for QB val points
  var SAMPLE_TCC_pointsQBval  = fs.get_region_mean(tte_data_USE.select('tcc'), QB_val_pts_circles)
                              .map(function(feature) {
                                return ee.Feature(feature.select(['lat','lon','QB_val_avg','zone','mean','image_id'], null, false));
                              });
  
  
  /////////////////////////////////////////////////////////
  //---------------------- Export to CSV-------------------
  /////////////////////////////////////////////////////////
  var outTablename = 'SAMPLE_TCC_pointsQBval_'+buf_sz_plots+'m';
  Export.table.toDrive({
    folder: out_table_folder_name,
    collection: SAMPLE_TCC_pointsQBval,
    description: outTablename,
    fileNamePrefix: outTablename,
    fileFormat: 'CSV'
  });
  
  var outTablename = 'SAMPLE_TCC_plotsEUR_'+buf_sz_plots+'m';
  Export.table.toDrive({
    folder:out_table_folder_name,
    collection: SAMPLE_TCC_plotsEUR,
    description: outTablename,
    fileNamePrefix: outTablename,
    fileFormat: 'CSV'
  });
  */
  
  fs.get_zonalstats_export(tte_data_USE.select('tcc'), plot_circles, res, 'SAMPLE_TCC_plotsEUR_'+tte_version, true, out_table_folder_name, tte_version);
  fs.get_zonalstats_export(tte_data_USE.select('tcc'), QB_val_pts_circles, res, 'SAMPLE_TCC_pointsQBval_'+tte_version, true, out_table_folder_name, tte_version);
  //print(QB_val_pts_circles)
  //print(plot_circles)
  Map.addLayer(plot_circles, {}, 'plots')
  ///////////////////////
  //Arctic NDVI Trends (GIMMS3G) 1982-2012

  /////////////////////////////////////////////////////////////////
  // TTE ZONES x NDVI
  ////////////////////
  var tte_zone_sparse_true_NDVI = ndvi_trend_landsat.updateMask(tte_zone_sparse_true);
  var tte_leading_edge_NDVI = ndvi_trend_landsat.updateMask(tte_leading_edge);
  var tte_zone_open_NDVI = ndvi_trend_landsat.updateMask(tte_zone_open);
  
  var ndvi_viz = {min:-0.01, max:0.01, palette: ['#8c510a','#bf812d','#dfc27d','#f6e8c3','#f5f5f5','#c7eae5','#80cdc1','#35978f','#01665e']};
  Map.addLayer(ndvi_trend_gimms, ndvi_viz, 'NDVI Trends (GIMMS)', false)
  Map.addLayer(tte_leading_edge_NDVI, ndvi_viz, 'NDVI Trends (Landsat) in TTE LeadEdge', false)
    Map.addLayer(tte_zone_sparse_true_NDVI, ndvi_viz, 'NDVI Trends (Landsat) in TTE Sparse', false)
      Map.addLayer(tte_zone_open_NDVI, ndvi_viz, 'NDVI Trends (Landsat) in TTE Open', false)
  
  ////////////////////////////////////////////////////////////////
  // ZONAL STATS
  // Run all export ZSTATS table for the Env Covariates
  var hydroname = 'L08'
  var realms = ['NA','EU'];
  var covars = ['NDVI_LANDSAT', 'NDVI_GIMMS', 'PERM']//['NDVI_LANDSAT', 'NDVI_GIMMS', 'PERM','TEMP'];  //ZSTATS is appropriate for continuous vars
  var covars = ['NDVI_LANDSAT', 'NDVI_GIMMS', 'PERM','BIO10','BIO01','BIO02','BIO08','BIO09','BIO11','BIO18']
  
  for (var i = 0; i < realms.length; i++){
    var realm = realms[i];
    if (realm == 'EU') {var smry_fc = hydrob_L08_EU;} else {var smry_fc = hydrob_L08_NA;}
    
    print("TTE ZONES: Area of ZONES per HYDROBASIN; CIRCUMPOLAR (Leading Edge, Sparse, Open)")
    fs.get_area_export(tte_data_USE.select('tte_zones'), smry_fc, res, 'tte_zones_'+realm+'_'+hydroname, true, out_table_folder_name, 'zones')
    print("TTE CLASSIFICATION: AREA of CLASS per HYDROBASIN; CIRCUMPOLAR")
    fs.get_area_export(tte_data_USE.select('tte_classification'), smry_fc, res, 'tte_class_'+realm+'_'+hydroname, true, out_table_folder_name, 'class')
    print("TTE DOMAIN: AREA of TTE BIOCLIM ENVELOPE per HYDROBASIN; CIRCUMPOLAR")
    fs.get_area_export(tte_data_USE.select('tte_domain'), smry_fc, res, 'tte_envelope_'+realm+'_'+hydroname, true, out_table_folder_name, 'envelope'); 
    
    print("LANDFORMS: Get Area of LANDFORMS at Leading Edge, Sparse, Open per L08 HYDROBASINs")
    // this cant export---needs fixing somehow..
    var tte_le = fs.get_area_export(tte_leading_edge_landforms, smry_fc, res, 'tte_leading_edge_tte_landforms_'+realm+'_'+hydroname, false, out_table_folder_name, 'landforms in leading_edge');
    var tte_sparse = fs.get_area_export(tte_zone_sparse_true_landforms, smry_fc, res, 'tte_zone_sparse_true_tte_landforms_'+realm+'_'+hydroname, false, out_table_folder_name, 'landforms in sparse_true');
    var tte_open = fs.get_area_export(tte_zone_open_landforms, smry_fc, res, 'tte_zone_open_tte_landforms_'+realm+'_'+hydroname, false, out_table_folder_name, 'landforms in open');
    
    // Export a merged table
    var desc = 'AREA_'+'tte_landforms_'+realm+'_'+hydroname+'_'+res+'m';
    Export.table.toDrive({
          collection: tte_sparse.merge(tte_le).merge(tte_open),
          description: desc,
          folder: out_table_folder_name,
          fileNamePrefix: desc,
          fileFormat: 'CSV'
          });
          
    for (var j = 0; j < covars.length; j++){
      var covar = covars[j];
      print("Zonal stats exports:"+tte_version+", "+ realm+", "+covar);
      if (covar == 'NDVI_LANDSAT') {var image = ndvi_trend_landsat;} 
      else if (covar == 'NDVI_GIMMS') {var image = ndvi_trend_gimms;}
      else if (covar == 'PERM') {var image = permprob;} 
      else if (covar == 'BIO10') {var image = bio2.select('bio_10');}
      else if (covar == 'BIO01') {var image = bio2.select('bio_01');}
      else if (covar == 'BIO02') {var image = bio2.select('bio_02');}
      else if (covar == 'BIO08') {var image = bio2.select('bio_08');}
      else if (covar == 'BIO09') {var image = bio2.select('bio_09');}
      else if (covar == 'BIO11') {var image = bio2.select('bio_11');}
      else if (covar == 'BIO18') {var image = bio2.select('bio_18');}
      
      if ( (covar == 'BIO10' ) ||  (covar == 'PERM')){
      // SAMPLE 10k pts to relate tte classes with covar
      /*// THIS DOES NOT WORK CURRENTLY
      var SAMPLES_tteclass_covar = smry_fc.map(function(feature){
                            var sample_fc = tte_data_USE.select('tte_classification')
                                                        .addBands(image.updateMask(tte_data_USE.select("tte_classification")))
                                                        .clip(feature)
                                                        .sample({
                                                                    numPixels: 100,
                                                                    tileScale:3,
                                                                    dropNulls: true,
                                                                    //factor: 0.001,
                                                                    //projection: tte_data_USE.select(0).projection(),
                                                                    scale: 30, 
                                                                    geometries: false
                                                          });
                                return sample_fc;
      });*/
      var SAMPLES_tteclass_covar = tte_data_USE.select('tte_classification')
                                  .addBands(image.updateMask(tte_data_USE.select("tte_classification")))
                                  .sample({
                                  numPixels: 10000,
                                  region: smry_fc,
                                  tileScale:3,
                                  dropNulls: true,
                                  //factor: 0.001,
                                  //projection: tte_data_USE.select(0).projection(),
                                  scale: 30, 
                                  geometries: false
                                });
      Export.table.toDrive({
          folder: out_table_folder_name,
          collection: SAMPLES_tteclass_covar,
          description: 'SAMPLES_tteclass_'+covar+'_'+realm+'_'+tte_version,
          fileNamePrefix: 'SAMPLES_tteclass_'+covar+'_'+realm+'_'+tte_version,
          fileFormat: 'CSV'
          });
      }
      var tte_sparse = fs.get_zonalstats_export(image.updateMask(tte_zone_sparse_true), smry_fc, res, 'tte_zone_sparse_true_'+covar+'_'+realm+'_'+hydroname, false, out_table_folder_name, 'sparse_true');
      var tte_le = fs.get_zonalstats_export(image.updateMask(tte_leading_edge), smry_fc, res, 'tte_leading_edge_'+covar+'_'+realm+'_'+hydroname, false, out_table_folder_name, 'leading_edge');
      var tte_open = fs.get_zonalstats_export(image.updateMask(tte_zone_open), smry_fc, res, 'tte_zone_open_'+covar+'_'+realm+'_'+hydroname, false, out_table_folder_name, 'open');

       // Export a merged table
       var desc = 'ZSTATS_'+'tte_'+covar+'_'+realm+'_'+hydroname+'_'+res+'m';
        Export.table.toDrive({
          collection: tte_sparse.merge(tte_le).merge(tte_open),
          description: desc,
          folder: out_table_folder_name,
          fileNamePrefix: desc,
          fileFormat: 'CSV'
          });
      
      /*
      // Hold off on this for now
      fs.get_zonalstats_export(image.updateMask(MOSTVULN_tte_zone_sparse_true_NORTHFACE), smry_fc, res, 'MOSTVULN_tte_zone_sparse_true_NFACE_'+covar+'_'+realm+'_'+hydroname, out_table_folder_name);
      fs.get_zonalstats_export(image.updateMask(MOSTVULN_tte_leading_edge_NORTHFACE), smry_fc, res, 'MOSTVULN_tte_leading_edge_NFACE_'+covar+'_'+realm+'_'+hydroname, out_table_folder_name);
      fs.get_zonalstats_export(image.updateMask(MOSTVULN_tte_zone_sparse_true_SOUTHFACE), smry_fc, res, 'MOSTVULN_tte_zone_sparse_true_SFACE_'+covar+'_'+realm+'_'+hydroname, out_table_folder_name);
      fs.get_zonalstats_export(image.updateMask(MOSTVULN_tte_leading_edge_SOUTHFACE), smry_fc, res, 'MOSTVULN_tte_leading_edge_SFACE_'+covar+'_'+realm+'_'+hydroname, out_table_folder_name);
      fs.get_zonalstats_export(image.updateMask(MOSTVULN_tte_zone_sparse_true_FLAT), smry_fc, res, 'MOSTVULN_tte_zone_sparse_true_FLAT_'+covar+'_'+realm+'_'+hydroname, out_table_folder_name);
      fs.get_zonalstats_export(image.updateMask(MOSTVULN_tte_leading_edge_FLAT), smry_fc, res, 'MOSTVULN_tte_leading_edge_FLAT_'+covar+'_'+realm+'_'+hydroname, out_table_folder_name);
      */
    }
  }
}
Map.addLayer(ee.Image().paint(hydrob_L08_NA, 1, 2),{}, 'hydrob_L08_NA');
//////////////////////////////////////////////////
// Map Legends, etc
//
/////////////////////////////////////////////////
fs.makeMapGrey()
fs.add_legend('TTE Classification',
                          ['Sparse TCC <= 5% & Uniform gradient',
                          'Sparse TCC <= 5% & Diffuse-gradual gradient',
                          'Sparse TCC <= 5% & Diffuse-rapid gradient',
                          'Sparse TCC <= 5% & Abrupt gradient',
                          'Open TCC 6-30% & Uniform gradient',
                          'Open TCC 6-30% & Diffuse-gradual gradient',
                          'Open TCC 6-30% & Diffuse-rapid gradient',
                          'Open TCC 6-30% & Abrupt gradient',
                          'Int. TCC > 30%', //(TTE ZONES 3 & 4)
                          'Leading Edge: Not-Water Adjacent',
                          'Leading Edge: Water Adjacent'],
                          tte_class_pal)
                          
/*fs.add_legend('Landforms',
                          ['0: unclassified','1: local lowland','2: midslope drainages','3: upland','4: U-shaped valleys',
                          '5: plains','6: open slopes','7: upper slopes','8: local ridges','9: midslope ridges',
                          '10: hill/mtn tops & ridges'], pal_land_unclass)
Map.add(fs.makeLegend(ndvi_viz, '  <--    NDVI Trend  -->'));*/
//fs.add_legend('Global Forest Height (m)', ['6','','','','','','>25'], pal_height)
