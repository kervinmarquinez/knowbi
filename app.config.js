// Config dinámica de Expo. Mantiene app.json como base y solo sobreescribe
// googleServicesFile para que en EAS Build venga del secret GOOGLE_SERVICES_JSON
// (tipo file) en lugar del repo. En local cae al fichero ./google-services.json.
export default ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
});
