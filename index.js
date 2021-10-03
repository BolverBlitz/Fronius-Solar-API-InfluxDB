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
	const Inv_Realtime_V_res = await fetch(`http://${process.env.Fronius_IP}/solar_api/v1/GetInverterRealtimeData.cgi?scope=Device&DeviceId=1&DataCollection=3PInverterData`);
	const Inv_Realtime_DC_res = await fetch(`http://${process.env.Fronius_IP}/solar_api/v1/GetInverterRealtimeData.cgi?scope=Device&DeviceId=1&DataCollection=CommonInverterData`);
	const Inv_Day_Peaks_res = await fetch(`http://${process.env.Fronius_IP}/solar_api/v1/GetInverterRealtimeData.cgi?scope=Device&DeviceId=1&DataCollection=MinMaxInverterData`);
	const Inv_Realtime_data = await Inv_Realtime_res.json();
	const Inv_Realtime_V_data = await Inv_Realtime_V_res.json();
	const Inv_Realtime_DC_data = await Inv_Realtime_DC_res.json();
	const Inv_Day_Peaks_data = await Inv_Day_Peaks_res.json();

	if(Object.keys(Inv_Realtime_V_data.Body.Data).length === 0){
		Inv_Realtime_V_data.Body.Data = {
			IAC_L1: {Value: 0},
			IAC_L2: {Value: 0},
			IAC_L3: {Value: 0},
			UAC_L1: {Value: 0},
			UAC_L2: {Value: 0},
			UAC_L3: {Value: 0}
		}
	}

	if(Object.keys(Inv_Realtime_DC_data.Body.Data).length === 4){
		Inv_Realtime_DC_data.Body.Data = {
			FAC: {Value: 0},
			IAC: {Value: 0},
			IDC: {Value: 0},
			UAC: {Value: 0},
			UDC: {Value: 0}
		}
	}

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
                wh_total: Inv_Realtime_data.Body.Data.TOTAL_ENERGY.Values[1],
				I_AC_L1: Inv_Realtime_V_data.Body.Data.IAC_L1.Value,
				I_AC_L2: Inv_Realtime_V_data.Body.Data.IAC_L2.Value,
				I_AC_L3: Inv_Realtime_V_data.Body.Data.IAC_L3.Value,
				U_AC_L1: Inv_Realtime_V_data.Body.Data.UAC_L1.Value,
				U_AC_L2: Inv_Realtime_V_data.Body.Data.UAC_L2.Value,
				U_AC_L3: Inv_Realtime_V_data.Body.Data.UAC_L3.Value,
				F_AC_All: Inv_Realtime_DC_data.Body.Data.FAC.Value,
				I_AC_All: Inv_Realtime_DC_data.Body.Data.IAC.Value,
				I_DC_All: Inv_Realtime_DC_data.Body.Data.IDC.Value,
				U_AC_All: Inv_Realtime_DC_data.Body.Data.UAC.Value,
				U_DC_All: Inv_Realtime_DC_data.Body.Data.UDC.Value,
				Peak_Day_P_AC: Inv_Day_Peaks_data.Body.Data.DAY_PMAX.Value,
				Peak_Day_V_AC: Inv_Day_Peaks_data.Body.Data.DAY_UACMAX.Value,
				Peak_Day_V_DC: Inv_Day_Peaks_data.Body.Data.DAY_UDCMAX.Value
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