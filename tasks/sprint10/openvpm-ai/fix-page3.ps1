$path = Join-Path $PWD "apps\web\app\(dashboard)\field-visits\page.tsx"
$lines = [System.IO.File]::ReadAllLines($path, [System.Text.Encoding]::UTF8)
$result = [System.Collections.Generic.List[string]]::new()
foreach ($line in $lines) {
    if ($line -match 'MicButton') { continue }
    $result.Add($line)
}
[System.IO.File]::WriteAllLines($path, $result, [System.Text.Encoding]::UTF8)
$mbCount = (Select-String -Path $path -SimpleMatch 'MicButton').Count
Write-Host "Done. Lines: $($result.Count). MicButton: $mbCount"
