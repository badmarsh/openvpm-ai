import subprocess
sql = chr(39) + "SELECT name, token FROM " + chr(34) + "apiKeys" + chr(34) + " LIMIT 5;" + chr(39)
r = subprocess.run([chr(39)+"docker"+chr(39),chr(39)+"exec"+chr(39),chr(39)+"-i"+chr(39),chr(39)+"apps-outline-jjs5zi-postgres-1"+chr(39),chr(39)+"psql"+chr(39),chr(39)+"-U"+chr(39),chr(39)+"outline"+chr(39),chr(39)+"-d"+chr(39),chr(39)+"outline"+chr(39),chr(39)+"-c"+chr(39),sql],capture_output=True,text=True)
print(r.stdout)
print(r.stderr)
