require('dotenv').config();
const fetch = require('node-fetch');
const Influxdb = require('influxdb-v2');

/* Create InfluxClient */
const db = new Influxdb({
	host: process.env.Influx_Host,
	protocol: process.env.Influx_Protocol,
	port: process.env.Influx_Port,
	token: process.env.Influx_Token
});

async function writeNewDataPoint() {
	const res = await fetch(`http://${process.env.Fronius_IP}/solar_api/v1/GetInverterRealtimeData.cgi?Scope=System`);
	const data = await res.json();
    //console.log(data)
	await db.write(
	{
		org: process.env.Database_Orga,
		bucket: process.env.Database_Bucket,
		precision: 'ms'
	},
	[{
			measurement: process.env.Database_Measurement,
			tags: {host: process.env.SolarName},
			fields:
			{
				power: data.Body.Data.PAC.Values[1],
                wh_day: data.Body.Data.DAY_ENERGY[1],
                wh_year: data.Body.Data.YEAR_ENERGY[1],
                wh_total: data.Body.Data.TOTAL_ENERG[1]
			},
	}]
	);
}

function gather_and_save_data ()
{
	writeNewDataPoint().catch(error => {
		console.error('\nAn error occurred!', error);
	});
}

setInterval(gather_and_save_data, 1000);