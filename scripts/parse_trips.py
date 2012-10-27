#!/usr/bin/python
"""
Parse trips.csv from HubwayDataChallenge.org.
Reformat date according to what Google Fusion wants,
add day-of-week for filtering.
"""

"""
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
"""

__author__ = """Jacob Silterra"""

import datetime
import random
import argparse

parser = argparse.ArgumentParser(description='Process and sample trips')
parser.add_argument('--fraction', dest='fraction', default=1.0,
                   help='Fraction (0..1.0) of trips to output')

trips_path = "trips.csv"

#Column names and numbers
trip_string_fields = {'id':0, 'status': 1, 'start_date': 3, 'start_station_id': 4,
                      'end_date': 5, 'end_station_id': 6}

#duration is in seconds
trip_float_fields = {'duration': 2}

time_format = "%H:%M"

# A class building tzinfo objects for fixed-offset time zones.
# Note that FixedOffset(0, "UTC") is a different way to build a
# UTC tzinfo object.
ZERO = datetime.timedelta(0)
class FixedOffset(datetime.tzinfo):
    """Fixed offset in minutes east from UTC."""

    def __init__(self, offset, name):
        self.__offset = datetime.timedelta(minutes = offset)
        self.__name = name

    def utcoffset(self, dt):
        return self.__offset

    def tzname(self, dt):
        return self.__name

    def dst(self, dt):
        return ZERO
        
def get_dict(line, string_fields, float_fields):
    vals = line.split(",")
    stat = { key: vals[string_fields[key]].replace('"','').strip() for key in string_fields}
    for key, colnum in float_fields.iteritems():
        stat[key] = float(vals[colnum].strip())
    return stat

input_datetime_format = "%Y-%m-%d %H:%M:%S"
date_fields = ['start_date', 'end_date']
def get_trip(line):
    """Create dictionary of trip data from `line`"""
    trip_dict = get_dict(line, trip_string_fields, trip_float_fields)
    
    for key in date_fields:
        #We need to manually parse time zone
        date_str = trip_dict[key]
        tz_str = date_str[-3:]
        tz_mins = int(tz_str) * 60
        tzinfo = FixedOffset(tz_mins, "Pacific?")
        tmp = datetime.datetime.strptime(date_str[0:-3], input_datetime_format)
        trip_dict[key] = tmp.replace(tzinfo=tzinfo)

    return trip_dict

def create_time_dict(indatetime, prepend, hours_offset=3):
    """Creates a time dict, shifting times by `hours_offset` (default 3)"""
    out_dict = {}
    outdt = indatetime.tzinfo.utcoffset(None) + datetime.timedelta(hours=hours_offset)
    outtz = FixedOffset( outdt.total_seconds() / (60), "Eastern")
    indt = indatetime.astimezone(outtz)
    out_dict[prepend + '_' + 'day'] = indt.strftime("%Y.%m.%d")
    out_dict[prepend + '_' + 'dow'] = indt.weekday()
    out_dict[prepend + '_' + 'time'] = indt.strftime("%H:%M")
    return out_dict

if __name__ == "__main__":
    
    
    args = parser.parse_args()
    fraction = float(args.fraction)
    
    trips_file = open(trips_path, "r")
    trips_file.readline()

    init_columns = ['id', 'duration', 'start_station_id', 'end_station_id']
    add_columns = ['start_day', 'start_dow', 'start_time', 'end_day', 'end_dow', 'end_time', 'min_station_id']
    out_columns = init_columns + add_columns

    delim = ","

    print delim.join(out_columns)
    
    for line in trips_file:
        if random.random() >= fraction:
            continue
        
        trip = get_trip(line)
        min_id = -1;
        try:
            sid = int(trip['start_station_id'])
            eid = int(trip['end_station_id'])
            min_id = min(sid, eid);
        except Exception,e:
            continue;

        start_date, end_date = trip['start_date'], trip['end_date']
        start_dict = create_time_dict(start_date, 'start')
        end_dict = create_time_dict(end_date, 'end')

        trip.update(start_dict)
        trip.update(end_dict)
        trip['min_station_id'] = min_id

        out_str = delim.join(["%s" % trip[x] for x in out_columns])
        print out_str

        
        
        
        



