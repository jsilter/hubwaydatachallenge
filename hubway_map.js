/*
Copyright (c) 2012, Jacob Silterra
All rights reserved.
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>
*/

//Should be imported already from a separate file
var GOOGLE_BROWSER_KEY = GOOGLE_BROWSER_KEY;

var fusion_query_url="https://www.googleapis.com/fusiontables/v1/query";
var google_shorten_url="https://www.googleapis.com/urlshortener/v1/url";

//Google table IDs. These may be taken down at any time,
//it is suggested you create your own fusion table
var stationTableId = "1TYoxLzEiq38FCr5N6iP-x_IF5JcP4qvuiH0vUvo";
//Contains a 5% sample. Loads faster, useful for testing
var testTripTableId = "1PEvVQaoTQ29WdGQr-XdlbZS2ocX6Z1xqFXlsjeo";
var fullTripTableId = "1XbTMbt4SDu8HBfJ7mJKTv5m9NLWyupfyfVudu0g";
var populationTableId = "1slogrMbvfK9uhACNjDBjwf9aiTzM4vfgRo6GRNY"
var tripTableId = fullTripTableId;
//-----------------------//

var timeColName = "start_time"

var MINUTES_IN_DAY = 24*60;
//For retrying on failure
var MIN_RETRY_INTERVAL = 0.2;
var retryInterval = MIN_RETRY_INTERVAL;

var stationSizeScale = 10;
var stationColorScale = 500;
var timeIncrMin = 15;
var startLat = 42.357053;
var startLng = -71.092622;
var startZoom = 13;
//When a station is clicked, we show outgoing arrows
//To keep the graph clean, we only show the top
//maxNumberArrows destinations
var maxNumberArrows = 5;

//Gets rewritten in initialize. Used for shortening URL
var base_url = "http://www.example.com/hubway_map.html"

var isPlaying = false;
var counterId = -1;

var map;
var bikeLayer;
var popLayer;

var stationMarkers = {};
var maxCacheSize = 5;
var responseCache = new ResponseCache(maxCacheSize);

function ResponseCache(maxNum){
	this.maxNum = maxNum;
	this.objects = {};
	this.keys = []

	this.put = function(key, object){
		if(!(key in this.objects)){
			this.keys.push(key);
		}
		this.objects[key] = object;

		if(this.keys.length > maxNum){
			var remkey = this.keys.shift();
			delete this.objects[remkey];
		}
	}

	//Get the object represented by key,
	//or null if it doesn't exist.
	//The object is left in the cache
	this.get = function(key){
		if(key in this.objects){
			return this.objects[key];
		}else{
			return null;
		}
	}

	this.pop = function(key){
		var index = this.keys.indexOf(key);
		if(index >= 0){
			var obj = this.objects[key];
			delete this.objects[key];
			this.keys.splice(index, 1);
		}else{
			return null;
		}
	}

	this.clear = function(){
		this.objects = {};
		this.keys = [];
	}
}

function getHourMinStr(minutes){
	if(minutes < 0){
		minutes += MINUTES_IN_DAY;
	}else{
		minutes = minutes % MINUTES_IN_DAY;
	}
    var hours = (minutes / 60 ) >> 0;
    var rem = minutes - hours*60;
    if(hours < 10){
        hours = "0" + hours;
    }

    if(rem < 10){
        rem = "0" + rem;
    }
    return hours + ":" + rem;
}


$(document).ready(initialize);
function initialize(){
    //jQuery.noConflict();
    $("#nojavascript").hide();
	base_url = $.url().attr('source').split('?')[0];

    changesEnabled = false;
    initializeControls();
    parseURLparams($.url().param());
    changesEnabled = true;
    initializeMap();
}

/*
Generate string containing all necessary query parameters
to recreate this graph
*/
function createURLParams(){
	out_comps = ["time=" + getSliderTime()];
	out_comps.push("stationSizeScale=" + stationSizeScale);
	out_comps.push("stationColorScale=" + stationColorScale);
	out_comps.push("dow=" + getDOWString());
	out_comps.push("showPopulation=" + $('#show-population').prop('checked'));
    out_comps.push("showBike=" + $('#show-bike').prop('checked'));
    var center = map.getCenter();
	out_comps.push("lat=" + center.lat());
	out_comps.push("lng=" + center.lng());
	out_comps.push("zoom=" + map.getZoom());
	out_str = out_comps.join("&");
	console.log(out_str);
	return out_str;
}

function parseURLparams(params){
    changesEnabled = false;
    if("time" in params){
        setTimeValue(params.time, true);
    }
    if("stationSizeScale" in params){
        setStationSizeScale(params.stationSizeScale, true);
    }
    if("stationColorScale" in params){
        setStationColorScale(params.stationColorScale, true);
    }
    if("dow" in params){
        //Comma separated list of day numbers
        dayNums = params.dow.split(",");
        $('#DOW>:checkbox').each(function() {
            this.checked = this.value in dayNums;
        });

    }
	if("showPopulation" in params){
		$('#show-population').prop('checked', params.showPopulation == 'true');
	}
	if("showBike" in params){
        $('#show-bike').prop('checked', params.showBike == 'true');
    }
    changesEnabled = true;
	if("lat" in params){
		startLat = params.lat;
	}
	if("lng" in params){
		startLng = params.lng;
	}
	if("zoom" in params){
		startZoom = parseInt(params.zoom);
	}
}

var changesEnabled = true;
function initializeControls(){
    $("#controls").show();
    initializeTimeSlider();
    initializeStationScaleSlider();
    initializeStationColorSlider();

    $('#DOW>:checkbox').change(function(){
        if(changesEnabled){
            displayTrips(getSliderTime());
        }
    });

    $('#DOW>#weekdays').click(getMultiCheckBoxSelector('#DOW>.weekday'));
    $('#DOW>#weekends').click(getMultiCheckBoxSelector('#DOW>.weekend'));

	$('#show-population').change(function(){
		if(this.checked){
			popLayer.setMap(map);
		}else{
			popLayer.setMap(null);
		}
	});

    $('#show-bike').change(function(){
        if(this.checked){
            bikeLayer.setMap(map);
        }else{
            bikeLayer.setMap(null);
        }
    });

	$('#share-button').click(function(){
		var permalink = base_url + "?" + createURLParams();
		$.ajax({url: google_shorten_url,
				type: 'POST',
				data: JSON.stringify({"longUrl": permalink}),
				dataType: "json",
				contentType: "application/json",
				success: function(data){
							$('#permalink-text').text(data['id']);
							$('#permalink-dialog').dialog();
							},
                error: errorHandler
				});
		});

	$('#play-button').click(function(){
		//$("#myTimeSlider").slider('value', 0);
		isPlaying = !isPlaying;
		if(isPlaying){
			//Fill up cache
			setLoading(true);
			var initTime= getSliderTime();
			for(var ii= 0; ii < maxCacheSize; ii++){
				var loadTime = initTime + ii*timeIncrMin;
				//console.log("preloading " + loadTime);
				downloadTrips(loadTime);
			}
			setLoading(false);
			counterId = setInterval(incrTimeForPlay, 1500);
		}else{
			clearInterval(counterId);
		}
	});


}

function incrTimeForPlay(){
	var minutes = getSliderTime();
	minutes += timeIncrMin;
	if(minutes > MINUTES_IN_DAY - timeIncrMin + 1){
		clearInterval(counterId);
		isPlaying = false;
		setTimeValue(timeIncrMin, true);
	}else{
		setTimeValue(minutes, true);
		//Download the next one
		var loadTime = minutes + (maxCacheSize-1)*timeIncrMin;
		loadTime = loadTime;
		downloadTrips(loadTime);
	}
}

/*
 *    Return a function which checks all boxes if any are unchecked,
 *    provided they match the given checkBoxSelector. If all are checked,
 *    they are all unchecked.
 */
function getMultiCheckBoxSelector(checkBoxSelector){
    return function(){
        var allSelected = true;
        $(checkBoxSelector).each(function(){
            allSelected &= this.checked;
        });

        changesEnabled = false;
        $(checkBoxSelector).each(function(){
            this.checked = !allSelected;
        });
        changesEnabled = true;
        displayTrips(getSliderTime());
    };

}

function setStationSizeScale(uivalue, setUI){
    if(setUI){
        $(".controlSlider#stationSizeScale").slider('value', uivalue)
    }
    stationSizeScale = uivalue
    redrawStations();
}

function setStationColorScale(uivalue, setUI){
    if(setUI){
        $(".controlSlider#stationColorScale").slider('value', uivalue)
    }
    stationColorScale = uivalue
    redrawStations();
}

function setTimeValue(minutes, setUI){
    if(setUI){
        $("#myTimeSlider").slider('value', minutes)
    }
    $("#myTimeLabel").text(getHourMinStr(minutes));
}

function setLoading(loading){
    var selector = "#ajax-loading";
    if(loading){
        $("#error-display").hide();
        $(selector).show();
    }else{
        $(selector).hide();
    }
}

function initializeTimeSlider(){
    var max = MINUTES_IN_DAY - timeIncrMin;
    var slider = $("#myTimeSlider").slider({
        step: timeIncrMin,
        min: timeIncrMin,
        max: max,
        slide: function(event, ui){
            setTimeValue(ui.value, false);
        }
    });
    //Don't want to query when initializing slider,
    //so we set the change listener after
    setTimeValue(MINUTES_IN_DAY / 2, true);
    slider.bind('slidechange', function(event, ui){
        displayTrips(getSliderTime());
    });
}

function initializeStationScaleSlider(){

    var max = stationSizeScale*2;
    var slider = $(".controlSlider#stationSizeScale").slider({
        step: max/100,
        value: stationSizeScale,
        min: 1,
        max: max,
        change: function(event, ui){
            setStationSizeScale(ui.value, false);
        }
    });
    var value = slider.slider('value');
    setStationSizeScale(value);
}

function initializeStationColorSlider(){

    var max = stationColorScale*2;
    var slider = $(".controlSlider#stationColorScale").slider({
        step: max/100,
        value: stationColorScale,
        min: 1,
        max: max,
        change: function(event, ui){
            setStationColorScale(ui.value, false);
        }
    });
    var value = slider.slider('value');
    setStationColorScale(value, false);
}

function initializeMap(){
    var mapOptions = {
        center: new google.maps.LatLng(startLat, startLng),
        zoom: startZoom,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    };

    map = new google.maps.Map(document.getElementById("map_canvas"),
                                                      mapOptions);

    bikeLayer = new google.maps.BicyclingLayer();
    $('#show-bike').change();

	//Add fusion layer with population
	popLayer = new google.maps.FusionTablesLayer({
		query: {
			select: 'border_points',
			from: populationTableId,
			where: 'POP10 > 0'
			},
			heatmap: {enabled: false}
		});
    queryStations();

	$('#show-population').change();
}

/*
 *    Get location of hubway stations. We could use the FusionTables API
 *    for this (see https://developers.google.com/maps/documentation/javascript/layers#FusionTables), but
 *    since I want to build an object of the stations for later plotting I'm doing it manually
 */
function queryStations(){
    setLoading(true);
    clearStationMarkers();

    var sql_text = "SELECT id, name, lat, lng, days_active FROM " + stationTableId;

    var full_query_url = fusion_query_url + "?key=" + GOOGLE_BROWSER_KEY;
    full_query_url += "&sql=" + sql_text;

    //console.log(full_query_url);
    $.get(full_query_url, stationDataHandler);

}

function getDOWString(){
    //Dummy value just so it's never empty
    var allVals = ["-1"];
    $('#DOW>:checkbox').each(function() {
        if(this.checked){
            allVals.push(this.value);
        }
    });
    return allVals.join(",");
}

function getDOWCount(){
    var count = 0;
    $('#DOW>:checkbox').each(function() {
        if(this.checked){
            count += 1
        }
    });
    return count;
}

function scaleByDOW(scalar){

    //What we want is average among days selected,
    //so we scale up when some not selected
    //Neglect the edge effects from days_active not being
    //a multiple of 7
    var DOWCount = getDOWCount();
    if(DOWCount > 0){
        var DOWScale = 7.0/DOWCount;
        if(DOWScale != 1.0){
            scalar *= DOWScale;
        }
    }
    return scalar;
}

//Linearly interpolate flux to get color
//blue if negative, red if positive
//We fix the saturation, move intensity from high (white)
//to low (colored) as colorValue increases
function getColorStr(colorValue){

    var colorValue = Math.floor(colorValue);
    var absColor = Math.abs(colorValue);
    var minIntens = 40;
    var maxIntens = 100;
    var intens =  Math.max(Math.min(maxIntens - Math.abs(absColor), maxIntens), minIntens);
    var saturation = 90;
    var redHue = 0;
    var blueHue = 220;
    var pathHue = 34;

    var colorStr = "hsl("
    if(path){
        colorStr +=  pathHue;
    }else if(colorValue >= 0){
        colorStr += redHue;
    }else{
        colorStr += blueHue;
    }
    colorStr += "," + saturation + "%," + intens + "%)"
    return colorStr;
}

function getSliderTime(){
	return $("#myTimeSlider").slider('value');
}
/*
 *    Get a clause suitable for SQL based on time controls
 */
function getDateTimeClause(midTimeVal){
    var dowString = getDOWString();

    var halfWidth = timeIncrMin;
    var minTimeStr = getHourMinStr(midTimeVal - halfWidth);
    var maxTimeStr = getHourMinStr(midTimeVal + halfWidth);

    //Note the single quotes around the time
    var outStr = timeColName + " >= '" + minTimeStr + "' AND " + timeColName + " < '" + maxTimeStr + "'";
    outStr += " AND " + "start_dow IN (" + dowString + ")";
	//console.log(outStr);

    return outStr;
}

function generateTripQueryURL(midTimeVal){
	//This throws a parser error sometimes due to Nan or Null when ids are bad, so we apply a rather pointless filter
    var sql_text = "SELECT start_station_id, end_station_id, COUNT() AS outgoing";
	//sql_text += ", min_station_id"
	sql_text += " FROM " + tripTableId;
    sql_text += " WHERE start_station_id >= 0 AND end_station_id >= 0";

    //Filter by time and day of week.
    sql_text += " AND " + getDateTimeClause(midTimeVal);
    //Only interested in aggregate statistics here
    sql_text += " GROUP BY start_station_id, end_station_id"; //,min_station_id
	//So we can render one station at a time
	//sql_text += " ORDER BY min_station_id";

    var full_query_url = fusion_query_url + "?key=" + GOOGLE_BROWSER_KEY;
    full_query_url += "&sql=" + sql_text;

	return full_query_url;
}
function displayTrips(midTimeVal){
	if(!changesEnabled){
		return downloadTrips(midTimeVal);
	}
	var cacheKey = midTimeVal + getDOWString();
    var handler = getDisplayTripHandler(cacheKey);
	return downloadOrDisplayTrips(midTimeVal, cacheKey, handler);
}

function downloadTrips(midTimeVal){
	var cacheKey = midTimeVal + getDOWString();
    var handler = getDownloadTripHandler(cacheKey);
	return downloadOrDisplayTrips(midTimeVal, cacheKey, handler);
}

function downloadOrDisplayTrips(midTimeVal, cacheKey, handler){
	setLoading(true);
	var full_query_url = generateTripQueryURL(midTimeVal);

	//Check cache, use that value if we have it
	var jsonResponse = responseCache.get(cacheKey);

	if(jsonResponse != null){
		setTimeout(function(){handler(jsonResponse)}, 0);
	}else{
		$.ajax({url: full_query_url, success: handler,
			error: tripErrorHandler});
	}
}
function tripErrorHandler(jqXHR, textStatus, errorThrown){
	retryInterval *= 1.5;
	
	if(jqXHR.status >= 500){
		console.log("tripErrorHandler retrying");
		errorThrown = "Error loading trip data; retrying in " + retryInterval.toFixed(2) + " seconds"; 
		setTimeout(function(){displayTrips(getSliderTime());}, retryInterval*1000);
	}
	
	errorHandler(jqXHR, textStatus, errorThrown);
}

function errorHandler(jqXHR, textStatus, errorThrown){
    console.log(jqXHR);
    console.log(textStatus);
    console.log(errorThrown);
    setLoading(false);
    $("#error-display").html("Error loading data: " + errorThrown).show();
}

//Handler for downloading data from server (or retrieving from cache)
//and displaying trip data.
function getDisplayTripHandler(cacheKey){
	return function(serverResponse){
		var jsonResponse = tripDataHandler(serverResponse);
		responseCache.put(cacheKey, jsonResponse);
		retryInterval = MIN_RETRY_INTERVAL;
		setLoading(false);
	};
}

//Handler for downloading data from server and caching it,
//it is not displayed. Always cache jsonResponse, don't want to
//parse it twice.
function getDownloadTripHandler(cacheKey){
	return function(response){
		if((typeof response) == "string"){
			response = $.parseJSON(response);
		}
		responseCache.put(cacheKey, response);
		retryInterval = MIN_RETRY_INTERVAL;
		setLoading(false);
	};
}

function tripDataHandler(response) {
    //What a hack. instanceof didn't work
    if((typeof response) == "string"){
        response = $.parseJSON(response);
    }

    var columns = response.columns;

    var startIdCol = columns.indexOf('start_station_id');
    var endIdCol = columns.indexOf('end_station_id');
    var outgoingCol = columns.indexOf('outgoing');

	mapFunctionStations(resetStationStatistics);
    if(!("rows" in response)){
        response.rows = [];
    }

    var rows = response.rows;
    for (var i = 0; i < rows.length; i++) {
        var item = rows[i];
		//console.log(item);

        var startId = parseInt(item[startIdCol]);
        var endId = parseInt(item[endIdCol]);
		//var minId = parseInt(item[minIdCol]);

        var numOutgoing = parseInt(item[outgoingCol]);

        startMarker = stationMarkers[startId];
        endMarker = stationMarkers[endId];

        incrMarkerValues(startMarker.outgoing, endId, numOutgoing);
        incrMarkerValues(endMarker.incoming, startId, numOutgoing);
    }

	redrawStations();
    setLoading(false);
	return response;
}

/*
    *    transitObj should be incoming/outgoing of a stationMarker
    *    otherId is the source/destination of the trip
    *    value is the amount by which to increment
    *    Make sure the weights are initialized first
    */
function incrMarkerValues(transitObj, otherId, value){
    transitObj.total += value;
    transitObj.weights[otherId] += value;
}

function recalcStationProps(stationMarker){
		//var stationMarker = stationMarkers[station_id];
		var activity = stationMarker.outgoing.total + stationMarker.incoming.total;
		var flux = stationMarker.outgoing.total - stationMarker.incoming.total;

		activity /= stationMarker.days_active;
		flux /= stationMarker.days_active;

		activity = scaleByDOW(activity);
		flux = scaleByDOW(flux);

		stationMarker.title = stationMarker.name;
		stationMarker.title += "\nAvg. Daily Activity: " + activity.toFixed(2);
		stationMarker.title += "\nAvg. Daily Flux: " + flux.toFixed(2);

		var cur_scale = Math.sqrt(activity) * stationSizeScale;
		cur_scale = Math.max(2, cur_scale);

		var colorStr = getColorStr(flux * stationColorScale);

		//Have to add it to the map again to get it to redraw
		stationMarker.getIcon().scale = cur_scale;
		stationMarker.getIcon().fillColor = colorStr;
}

function redrawStations(){
	mapFunctionStations(recalcStationProps);
    mapFunctionStations(updateStationSelected);
    mapFunctionStationsAsync(revalidateStation);
}

function revalidateStation(station){
    station.setMap(map);
}

function stationDataHandler(response) {

    //What a hack. instanceof didn't work
    if((typeof response) == "string"){
        response = $.parseJSON(response);
    }
    var rows = response.rows;
    var columns = response.columns;

    var idCol = columns.indexOf('id');
    var nameCol = columns.indexOf('name');
    var latCol = columns.indexOf('lat');
    var lngCol = columns.indexOf('lng');
    var days_activeCol = columns.indexOf('days_active');

    for (var i = 0; i < rows.length; i++) {
        var item = rows[i];
        var name = item[nameCol];
        var id = parseInt(item[idCol]);

        var marker = new google.maps.Marker({
            id: id,
            position: new google.maps.LatLng(item[latCol], item[lngCol]),
                                            days_active: item[days_activeCol],
                                            icon: {
                                                path: google.maps.SymbolPath.CIRCLE,
                                            scale: 2,
                                            strokeOpacity: 1,
                                            strokeWeight: 1,
                                            fillColor: "#FFFFFF",
                                            fillOpacity: 0.5,
                                            },
                                            map: map,
                                            name: name,
                                            title: name,
                                            selected: false
        });
    setStationMarkerListeners(marker);
    stationMarkers[id] = marker;
    }
    displayTrips(getSliderTime());
}


var lineSymbol = {path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW};
/**
    *    Initializes events for a single station marker
    */
function setStationMarkerListeners(stationMarker){
    google.maps.event.addListener(stationMarker, 'click', function() {
        this.selected = !this.selected;
        updateStationSelected(this);
    });
}

/*
Get a list of ids which represent the largest
maxNum (sorted descending) of the values in `weights`
*/
function getSortedIds(weights, maxNum){
	var ids = [];
    for(id in weights){
        ids.push(id);
    }
    if(ids.length > maxNum){
    	ids.sort(function(a_id, b_id){
                    return weights[b_id] - weights[a_id];
                });
                ids = ids.slice(0, maxNum);
    }
    return ids;
}

/**
Draw a marker from main to other if `outgoing` is true,
or from other to main if false.
The reason for that last parameter is we ALWAYS store a pointer for the path
in `mainMarker`, and also the weight is taken from mainMarker.outgoing if `outgoing`
and otherMarker.outgoing if not.
*/
function drawPath(mainMarker, otherMarker, outgoing){
	//source and dest are active for a different number of days
	//Scale by min
	var days_active = Math.min(mainMarker.days_active, otherMarker.days_active);
	var weight = mainMarker.outgoing.weights[otherMarker.id];
	if(!outgoing){
		weight = otherMarker.outgoing.weights[mainMarker.id];
	}

	weight *= 20.0 / days_active;
	weight = scaleByDOW(weight);
	weight = Math.min(10, weight);
	var colorWeight = weight;

	if(!outgoing){
		colorWeight *= -colorWeight;
	}

	var strokeColor = getColorStr(colorWeight*stationColorScale/50);
	if(otherMarker.id == mainMarker.id){
		var pathCoords = generateSelfLoop(mainMarker.position);
	}else{
		if(!outgoing){
			var pathCoords = generateCurvedLine(otherMarker.position,
											mainMarker.position, 4);
		}else{
			var pathCoords = generateCurvedLine(mainMarker.position,
											otherMarker.position, 4);
			}
	}

	var curPath = new google.maps.Polyline({
		path: pathCoords,
		strokeColor: strokeColor,
		strokeOpacity: 0.9,
		strokeWeight: Math.max(1.0, weight),
		icons: [{icon: lineSymbol,
				 offset: '100%'}]
	});

	if(outgoing){
		mainMarker.outgoingPaths[otherMarker.id] = curPath;
	}else{
		mainMarker.incomingPaths[otherMarker.id] = curPath;
	}
	curPath.setMap(map);
}
/*
    *    Update graph for a station being selected or not
    */
function updateStationSelected(station){
    if(station.selected){
        station.getIcon().strokeWeight = 3;

        //Only show up to maxNumberArrows
        //First sort descending
        var outgoingIds = getSortedIds(station.outgoing.weights, maxNumberArrows);
        for(var ind=0; ind < outgoingIds.length; ind++){
            var destMarker = stationMarkers[outgoingIds[ind]];
            drawPath(station, destMarker, true);
        }


        var incomingIds = getSortedIds(station.incoming.weights, maxNumberArrows);
        for(var ind=0; ind < incomingIds.length; ind++){
            var destMarker = stationMarkers[incomingIds[ind]];
            if(station == destMarker){
            	continue;
            }
            drawPath(station, destMarker, false);
        }


        //InfoWindow to display information persistently when selected
		if(!('infoWindow' in station)){
			var infoWindow = new google.maps.InfoWindow({
				content: station.title.replace(/\n/g, "<br/>"),
				flat: true,
				shadow: ""
			});
		station.infoWindow = infoWindow;
        }
        station.infoWindow.open(map, station);
    }else{
       clearStationPaths(station);
        if(station.hasOwnProperty('infoWindow')){
            station.infoWindow.close();
        }
    }
}


//Generates a self loop, counter clockwise, northeast
function generateSelfLoop(location){
    var dlat = 0.006;
    var dlng = 0.006;
    var end = new google.maps.LatLng(location.lat() + dlat, location.lng() + dlng);
    var firstPart = generateCurvedLine(location, end, 2);
    var secondPart = generateCurvedLine(end, location, 2);
    return firstPart.concat(secondPart);
}


function generateCurvedLine(start, end, radius_divisor) {

	/*
	In case anybody reads this, I want you to know
	that I know latitude and longitude are not the same as
	cartesian coordinates on a plane. However, I'm going to treat
	them that way to generate a nice pretty bezier curve. It's
	just visualization, it should be close enough at this scale.

	First we get a normal vector from source to dest. Then
	rotate it pi/2 clockwise, add that vector to the center
	coordinate, and make a curve with those three points
	*/
    var dlat = end.lat() - start.lat();
    var dlng = end.lng() - start.lng();

    var midLat = start.lat() + dlat/2;
    var midLng = start.lng() + dlng/2;

    //This isn't a typo (probably), we switch the coordinates
    //to accomplish the rotation
    var bendLat = midLat - dlng / radius_divisor;
    var bendLng = midLng + dlat / radius_divisor;
    var bendLatLng = new google.maps.LatLng(bendLat, bendLng);

    //Okay, now we have three points, and we want to curve
    //from start-center-end. Consider them Bezier control points
    var numPoints = 16;
    var delta = 1.0/numPoints;
    var curvePoints = [start];

    for (var ii=1; ii < numPoints; ii++) {
        var frac = ii*delta;
        var nextPoint = bezierLatLng(frac, start, bendLatLng, end);
        //console.log(nextPoint.lat() + "," + nextPoint.lng());
        curvePoints.push(nextPoint);
    }
    curvePoints.push(end);

    return curvePoints;
}

/**
*    Interpolate LatLng objects via bezier curve
*/
function bezierLatLng(t, p0, p1, p2){
    var lat = bezier(t, p0.lat(), p1.lat(), p2.lat());
    var lng = bezier(t, p0.lng(), p1.lng(), p2.lng());
    //Don't want to wrap
    return new google.maps.LatLng(lat, lng, true);
}
/*
*    Return a point along the bezier curve using p012 as
*    control points.
*    See http://en.wikipedia.org/wiki/Bezier_curve#Quadratic_B.C3.A9zier_curves
*    p<i> must be objects with addition defined.
*    0 <= t <= 1
*/
function bezier(t, p0, p1, p2){
    omt = 1-t;
    var ans = Math.pow(omt, 2) * p0;
    ans += 2*omt*t*p1;
    ans += Math.pow(t, 2) * p2;
    return ans;
}

function clearStationMarkers() {
    mapFunctionStations(function(station){
        station.setMap(null);
    });
    stationMarkers = {};
}

function getEmptyWeights(){
    weights = {}
    for(id in stationMarkers){
        weights[id] = 0;
    }
    return weights;
}

function resetStationStatistics(station) {
    station.incoming = {total: 0, weights: getEmptyWeights()};
    station.outgoing = {total: 0, weights: getEmptyWeights()};
    clearStationPaths(station);
    if(station.hasOwnProperty('infoWindow')){
        station.infoWindow.close();
        delete station.infoWindow;
    }
}

function clearStationPaths(station){
	station.getIcon().strokeWeight = 1;
	clearStationPaths1D(station.outgoingPaths);
	station.outgoingPaths = {};
	clearStationPaths1D(station.incomingPaths);
	station.incomingPaths = {};
}

function clearStationPaths1D(pathObj){
    for(otherId in pathObj){
        var path = pathObj[otherId];
        path.setMap(null);
        path = null;
    }
}

/*
*    Apply the specified function to each stationMarker.
*    Function gets one argument, the stationMarker
*/
function mapFunctionStations(func) {
    if (stationMarkers) {
        for (i in stationMarkers) {
            func(stationMarkers[i]);
        }
    }
}

/*
 * Just like mapFunctionStations,
 * except "asynchronous"
 */
function mapFunctionStationsAsync(func) {
    var newFunc = function(station){
        setTimeout(function(){func(station)}, 0);
    };
    mapFunctionStations(newFunc);
}

