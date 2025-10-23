$files = Get-ChildItem static\geojson -Recurse -File
$totalMB = ($files | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Output "Total: $([math]::Round($totalMB, 2)) MB en $($files.Count) archivos"
