import os from 'os'

export const getNetwork = (setServerUrl) => {
    const newtworkInterfaces = os.networkInterfaces();

    for (const key in newtworkInterfaces) {
        const addresses = newtworkInterfaces[key]

        for (const addres of addresses) {
            if (addres.family === 'IPv4' && addres.internal === false) {
                setServerUrl(`http://${addres.address}:8080`)
            }
        }
    }
}