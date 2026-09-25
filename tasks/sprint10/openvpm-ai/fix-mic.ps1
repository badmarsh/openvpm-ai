
$c = Get-Content "apps\web\app\(dashboard)\field-visits\page.tsx" -Raw

# Remove ++ lines
$c = $c -replace "\+\+ <div className=.flex items-center justify-between gap-2.>", ""
$c = $c -replace "\+\+   <Label className=.text-xs font-semibold.>3\. Diagnóza a klinický nález</Label>", ""
$c = $c -replace "\+\+   <MicButton getValue\(\) => formDiagnosis. setValue=.setFormDiagnosis. />", ""
$c = $c -replace "\+\+ </div>", ""
$c = $c -replace "\+\+   <Label className=.text-xs font-semibold.>Poznámka zootechnikovi & Ochranná lehota</Label>", ""
$c = $c -replace "\+\+   <MicButton getValue\(\) => formNotes. setValue=.setFormNotes. />", ""

# Now fix the diagnosis label to be a flex row with MicButton
$diagOld = '<Label className="text-xs font-semibold">3. Diagnóza a klinický nález</Label>'
$diagNew = '<div className="flex items-center justify-between gap-2"><Label className="text-xs font-semibold">3. Diagnóza a klinický nález</Label><MicButton getValue={() => formDiagnosis} setValue={setFormDiagnosis} /></div>'
$c = $c.Replace($diagOld, $diagNew)

# Fix notes label
$notesOld = '<Label className="text-xs font-semibold">Poznámka zootechnikovi & Ochranná lehota</Label>'
$notesNew = '<div className="flex items-center justify-between gap-2"><Label className="text-xs font-semibold">Poznámka zootechnikovi & Ochranná lehota</Label><MicButton getValue={() => formNotes} setValue={setFormNotes} /></div>'
$c = $c.Replace($notesOld, $notesNew)

# Clean up any double blank lines from removed ++ lines
$c = [regex]::Replace($c, "(?
){3,}", "`r`n`r`n")

Set-Content "apps\web\app\(dashboard)\field-visits\page.tsx" -Value $c -Encoding UTF8 -NoNewline
Write-Host "MicButton: $(([regex]::Matches($c, 'MicButton')).Count)"
Write-Host "PlusPlus: $(([regex]::Matches($c, '\+\+')).Count)"

