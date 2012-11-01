#!/usr/bin/python
"""
Parse stationstatus.csv from Hubway

In theory SQL could do a lot of this, but as long as we are using
Fusion we have some storage limits. Anyway, pre-aggregating will
speed up results.

We read the station status file, and average the capacity / nbBikes / % full
individually for each month, dow (e.g. sunday), and minute (e.g 22:54)
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

import sys
import argparse

import datetime, time
from parse_trips import FixedOffset, create_time_dict

from parse_trips import parse_date_str


"""
I assume that the format is decimal seconds
Technically this is wrong and we're mixing up
microseconds and milliseconds. However, I don't give a
shit because I'm only keeping to minute precision anyway
"""
input_datetime_format = "%Y-%m-%d %H:%M:%S.%f"


file_path = 'stationstatus.csv'

parser = argparse.ArgumentParser(description='Aggregate station status')
parser.add_argument('file', default=file_path,
                    help='stationstatus.csv file path')

int_fields = {'nbBikes': 3, 'nbEmptyDocks' : 4, 'capacity': 5}
frac_filled_cols = [int_fields['nbBikes'], int_fields['capacity']]
datetime_col = 2

delim = ","

def get_subdict(indict, keys):
    if(len(keys) > 1):
        td = get_subdict(indict, [keys[0]])
        return get_subdict(td, keys[1:])

    key = keys[0]
    if key in indict:
        return indict[key]
    else:
        sd = {}
        indict[key] = sd
        return sd

def add_to_dict(indict, key, toadd):
    """
    Adds a value to indict[key], which should be numeric.
    If the key is not present in indict, indict[key] = toadd
    """
    old_total = indict.get(key, 0)
    indict[key] = old_total + toadd

def make_print_line(itera, delim=","):
    tmp = ["%s" % x for x in itera]
    return delim.join(tmp) + "\n"

if __name__ == "__main__":

    #args = parser.parse_args()
    #file_path = args.file
    file_path = "/home/common/Downloads/Data/stationstatus/stationstatus.csv"
    out_file_path = "station_status_aggregates.csv"
    #print "Input File path: %s" % (file_path)

    fip = open(file_path, "rb")
    #Skip header
    fip.readline()

    #Highly nested. dict of station id, month, dow, minute
    stations = {}
    
    counter = 0
    maxlines = 200000**2
    skipped = []
    start_exec_time = time.time()
    last_date_str = ""
    for line in fip:
        try:
            tokens = line.strip().split(delim)

            station_id = int(tokens[1])
            station_dict = get_subdict(stations, [station_id])
           
            date_str = tokens[datetime_col]
            #For efficiency, only reparse date if it changes. Usually have same
            #string for 60+ stations
            if not (date_str == last_date_str):
                dt = parse_date_str(date_str, input_datetime_format)
                time_dict = create_time_dict(dt, '', hours_offset = 3)
                month = dt.month #between 1 and 12, inclusive.
                dow = time_dict['dow']
                tim = time_dict['time']

            md = get_subdict(station_dict, [month, dow, tim])
            add_to_dict(md, 'count', 1)

            for name, colnum in int_fields.iteritems():
                val = int(tokens[colnum])
                add_to_dict(md, name, val)

            capacity = float(tokens[frac_filled_cols[1]])
            frac_filled = -1
            if capacity > 0:
                frac_filled = float(tokens[frac_filled_cols[0]]) / capacity
            
            add_to_dict(md, 'frac_filled', frac_filled)
            
            last_date_str = date_str
            counter += 1
            if counter > maxlines:
                break
        except Exception, e:
            skipped.append(e)

    
    outfi = open(out_file_path, "wb")
    out_stats = ['nbBikes', 'nbEmptyDocks', 'capacity', 'frac_filled']
    header_line = ['station_id', 'month', 'dow', 'time']
    header_line.extend(out_stats)
    outfi.write(make_print_line(header_line))
    #Now we've aggregated all stats, print them out
    #Need to divide everything by totals
    for station_id, station_dict in stations.iteritems():
        for month, month_dict in station_dict.iteritems():
            for dow, dow_dict in month_dict.iteritems():
                for tim, tim_dict in dow_dict.iteritems():
                    cur_line = [station_id, month, dow, tim]
                    for field in out_stats:
                        tim_dict[field] /= tim_dict['count']
                        cur_line.append(tim_dict[field])

                    outfi.write(make_print_line(cur_line))

    end_exec_time = time.time()
    print "Time elapsed: %4.2f seconds" % (end_exec_time - start_exec_time)
    print "Skipped %d lines out of %d" % (len(skipped), counter)

                    
