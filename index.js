require('dotenv').config();
const fetch = require('node-fetch');
const Influxdb = require('influxdb-v2');
const GlobalClouter = {
	Fail: 0,
	Timeout: 0,
	Succsess: 0
}

/* Create InfluxClient */
const db = new Influxdb({
	host: process.env.Influx_Host,
	protocol: process.env.Influx_Protocol,
	port: process.env.Influx_Port,
	token: process.env.Influx_Token
});

async function writeNewDataPoint() {
	const Inv_Realtime_res = await fetch(`http://${process.env.Fronius_IP}/solar_api/v1/GetInverterRealtimeData.cgi?Scope=System`);
	const Inv_Realtime_data = await Inv_Realtime_res.json();
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
				power: Inv_Realtime_data.Body.Data.PAC.Values[1],
                wh_day: Inv_Realtime_data.Body.Data.DAY_ENERGY.Values[1],
                wh_year: Inv_Realtime_data.Body.Data.YEAR_ENERGY.Values[1],
                wh_total: Inv_Realtime_data.Body.Data.TOTAL_ENERGY.Values[1]
			},
	}]
	);
}

function gather_and_save_data ()
{
	writeNewDataPoint().then(function(Check) {
		GlobalClouter.Succsess++
		console.info(`Stats: Succsess: ${GlobalClouter.Succsess} / Timeouts: ${GlobalClouter.Timeout} / Fails: ${GlobalClouter.Fail}`);
	}).catch(error => {
		if(error.code === 'ETIMEDOUT'){
			GlobalClouter.Timeout++
			console.error(`Timeout to Solar API: ${process.env.Fronius_IP} | Stats: Succsess: ${GlobalClouter.Succsess} / Timeouts: ${GlobalClouter.Timeout} / Fails: ${GlobalClouter.Fail}`);
		}else{
			GlobalClouter.Fail++
			console.error(`Stats: Succsess: ${GlobalClouter.Succsess} / Timeouts: ${GlobalClouter.Timeout} / Fails: ${GlobalClouter.Fail}`);
			console.error('An error occurred!', error);
		}
		
		
	});
}

setInterval(gather_and_save_data, 5000);
