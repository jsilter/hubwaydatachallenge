#!/usr/bin/python
"""
Parse trips.csv from HubwayDataChallenge.org.
Reformat date according to what Google Fusion wants,
add day-of-week for filtering.
"""

"""

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
"""

__author__ = """Jacob Silterra"""

import datetime
import random

from parse_trips import get_trip, get_dict, FixedOffset

def get_station(line):
    stat_dict = get_dict(line, station_string_fields, station_float_fields)
    return stat_dict

stations_path = "stations.csv"
trips_path = "trips.csv"


#Column names and numbers
station_string_fields = {'id':0,'terminalName':1,'name':2}
station_float_fields = {'lat':6,'lng':7}


date_fields = ['start_date', 'end_date']


if __name__ == "__main__":
    init_stat_columns = ['id', 'terminalName', 'name', 'lat', 'lng']
    add_cols = ['days_active']
    all_columns = init_stat_columns + add_cols
    delim = ","
    
    stations_file = open(stations_path, "r")
    stations_file.readline()
    station_list = map(get_station, stations_file)
    station_dict = {int(x['id']): x for x in station_list}

    #Store the first and last trip for each station
    #for each year. Use to calculate days open

    years = [2011, 2012]
    for station in station_list:
        station['min_trip'] = {x: None for x in years}
        station['max_trip'] = {x: None for x in years}
    
    trips_file = open(trips_path, "r")
    trips_file.readline()

    
    for line in trips_file:
        trip = get_trip(line)

        try:
            sid = int(trip['start_station_id'])
            eid = int(trip['end_station_id'])
        except Exception,e:
            continue

        start_date, end_date = trip['start_date'], trip['end_date']
        if (end_date - start_date).days > 20 or end_date.month == 12:
            #Anomalous, skip
            continue
        
        trip_year = start_date.year
        
        station = station_dict[sid]

        if station['min_trip'][trip_year] is None:
            station['min_trip'][trip_year] = start_date
            station['max_trip'][trip_year] = start_date

        
        station_min = station['min_trip'][trip_year]
        station_max = station['max_trip'][trip_year]
            
        if(start_date < station_min):
            station['min_trip'][trip_year] = start_date

        if(start_date > station_max):
            station['max_trip'][trip_year] = start_date
        

    for station in station_list:
        station['days_active'] = 0
        for year in years:
            try:
                station['days_active'] += \
                    (station['max_trip'][year] - station['min_trip'][year]).days
            except TypeError, e:
                pass #don't have min or max for this year

        assert station['days_active'] > 0

    print delim.join(all_columns)
    for station in station_list:
        print delim.join("%s" % station[x] for x in all_columns)
        
                
        


        
        
        
        



