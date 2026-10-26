# Renders every dashboard HTML to a 1600x960 PNG using headless Microsoft Edge.
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir = $PSScriptRoot
New-Item -ItemType Directory -Force "$dir\images" | Out-Null
Get-ChildItem "$dir\0*.html" | ForEach-Object {
  $png = "$dir\images\$($_.BaseName).png"
  $url = "file:///" + $_.FullName.Replace('\', '/').Replace(' ', '%20')
  & $edge --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=1600,960 --screenshot="$png" $url 2>$null | Out-Null
}
