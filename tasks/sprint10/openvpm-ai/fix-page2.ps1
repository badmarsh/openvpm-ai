$path = Join-Path $PWD "apps\web\app\(dashboard)\field-visits\page.tsx"
$lines = [System.IO.File]::ReadAllLines($path, [System.Text.Encoding]::UTF8)
$result = [System.Collections.Generic.List[string]]::new()
foreach ($line in $lines) {
    if ($line -match 'import.*MicButton.*from') { continue }
    if ($line.TrimStart().StartsWith('++')) { continue }
    $line = $line -replace [regex]::Escape('<div className="flex items-center justify-between gap-2"><Label className="text-xs font-semibold">3. Diagnóza a klinický nález</Label><MicButton getValue={() => formDiagnosis} setValue={setFormDiagnosis} /></div>'), '<Label className="text-xs font-semibold">3. Diagnóza a klinický nález</Label>'
    $line = $line -replace [regex]::Escape('<div className="flex items-center justify-between gap-2"><Label className="text-xs font-semibold">Poznámka zootechnikovi & Ochranná lehota</Label><MicButton getValue={() => formNotes} setValue={setFormNotes} /></div>'), '<Label className="text-xs font-semibold">Poznámka zootechnikovi & Ochranná lehota</Label>'
    $result.Add($line)
}
[System.IO.File]::WriteAllLines($path, $result, [System.Text.Encoding]::UTF8)
$mbCount = (Select-String -Path $path -SimpleMatch 'MicButton').Count
$ppCount = (Select-String -Path $path -SimpleMatch '++ ').Count
Write-Host "Done. Lines: $($result.Count). MicButton: $mbCount. PlusPlus: $ppCount"
