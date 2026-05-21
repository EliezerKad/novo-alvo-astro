type CfLocation = {
  city?: string;
  country?: string;
  latitude?: string | number;
  longitude?: string | number;
  region?: string;
  regionCode?: string;
  timezone?: string;
};

const brazilStates: Record<string, { name: string; latitude: number; longitude: number; timezone: string }> = {
  AC: { name: 'Acre', latitude: -9.98, longitude: -67.81, timezone: 'America/Rio_Branco' },
  AL: { name: 'Alagoas', latitude: -9.66, longitude: -35.73, timezone: 'America/Maceio' },
  AP: { name: 'Amapa', latitude: 0.03, longitude: -51.07, timezone: 'America/Belem' },
  AM: { name: 'Amazonas', latitude: -3.12, longitude: -60.02, timezone: 'America/Manaus' },
  BA: { name: 'Bahia', latitude: -12.97, longitude: -38.5, timezone: 'America/Bahia' },
  CE: { name: 'Ceara', latitude: -3.73, longitude: -38.52, timezone: 'America/Fortaleza' },
  DF: { name: 'Distrito Federal', latitude: -15.79, longitude: -47.88, timezone: 'America/Sao_Paulo' },
  ES: { name: 'Espirito Santo', latitude: -20.32, longitude: -40.34, timezone: 'America/Sao_Paulo' },
  GO: { name: 'Goias', latitude: -16.68, longitude: -49.25, timezone: 'America/Sao_Paulo' },
  MA: { name: 'Maranhao', latitude: -2.53, longitude: -44.3, timezone: 'America/Fortaleza' },
  MT: { name: 'Mato Grosso', latitude: -15.6, longitude: -56.1, timezone: 'America/Cuiaba' },
  MS: { name: 'Mato Grosso do Sul', latitude: -20.45, longitude: -54.62, timezone: 'America/Campo_Grande' },
  MG: { name: 'Minas Gerais', latitude: -19.92, longitude: -43.94, timezone: 'America/Sao_Paulo' },
  PA: { name: 'Para', latitude: -1.45, longitude: -48.5, timezone: 'America/Belem' },
  PB: { name: 'Paraiba', latitude: -7.12, longitude: -34.86, timezone: 'America/Fortaleza' },
  PR: { name: 'Parana', latitude: -25.43, longitude: -49.27, timezone: 'America/Sao_Paulo' },
  PE: { name: 'Pernambuco', latitude: -8.05, longitude: -34.9, timezone: 'America/Recife' },
  PI: { name: 'Piaui', latitude: -5.09, longitude: -42.8, timezone: 'America/Fortaleza' },
  RJ: { name: 'Rio de Janeiro', latitude: -22.91, longitude: -43.17, timezone: 'America/Sao_Paulo' },
  RN: { name: 'Rio Grande do Norte', latitude: -5.79, longitude: -35.21, timezone: 'America/Fortaleza' },
  RS: { name: 'Rio Grande do Sul', latitude: -30.03, longitude: -51.23, timezone: 'America/Sao_Paulo' },
  RO: { name: 'Rondonia', latitude: -8.76, longitude: -63.9, timezone: 'America/Porto_Velho' },
  RR: { name: 'Roraima', latitude: 2.82, longitude: -60.67, timezone: 'America/Boa_Vista' },
  SC: { name: 'Santa Catarina', latitude: -27.59, longitude: -48.55, timezone: 'America/Sao_Paulo' },
  SP: { name: 'Sao Paulo', latitude: -23.55, longitude: -46.63, timezone: 'America/Sao_Paulo' },
  SE: { name: 'Sergipe', latitude: -10.91, longitude: -37.07, timezone: 'America/Maceio' },
  TO: { name: 'Tocantins', latitude: -10.18, longitude: -48.33, timezone: 'America/Araguaina' },
};

const normalizeCode = (value: unknown) => String(value || '').trim().toUpperCase();

export const onRequestGet = async ({ request }: { request: Request & { cf?: CfLocation } }) => {
  const cf = request.cf || {};
  const regionCode = normalizeCode(cf.regionCode);
  const state = brazilStates[regionCode] || brazilStates.SP;
  const isBrazil = normalizeCode(cf.country) === 'BR';
  const latitude = Number(cf.latitude) || state.latitude;
  const longitude = Number(cf.longitude) || state.longitude;
  const timezone = String(cf.timezone || state.timezone || 'America/Sao_Paulo');
  const label = isBrazil ? state.name : String(cf.region || cf.city || 'Sao Paulo');

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('current', 'temperature_2m');
    url.searchParams.set('timezone', timezone);

    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Weather ${response.status}`);
    const data = (await response.json()) as { current?: { temperature_2m?: number } };
    const temperature = Math.round(Number(data.current?.temperature_2m));

    return Response.json({
      label,
      regionCode: isBrazil ? regionCode || 'SP' : '',
      timezone,
      temperature: Number.isFinite(temperature) ? temperature : null,
    });
  } catch {
    return Response.json({
      label,
      regionCode: isBrazil ? regionCode || 'SP' : '',
      timezone,
      temperature: null,
    });
  }
};
