# Gera o catálogo estático; não altera as imagens. Execute novamente após adicionar fotos.
$ErrorActionPreference = 'Stop'
$galleryPhotos = Join-Path $PSScriptRoot 'fotos'
if (-not (Test-Path -LiteralPath $galleryPhotos -PathType Container)) {
  throw 'A pasta fotos não foi encontrada ao lado deste script.'
}
$galleryEntries = @(Get-ChildItem -LiteralPath $galleryPhotos -File |
  Where-Object { $_.Extension -match '^\.(png|jpe?g|webp|gif|avif|bmp|svg)$' } |
  Sort-Object Name | ForEach-Object { $_.Name })
$galleryJson = ConvertTo-Json -InputObject $galleryEntries -Depth 3
$galleryContent = "// Catálogo gerado por atualizar-fotos.ps1. Caminhos relativos à pasta fotos.`r`nwindow.GALERIA_FOTOS = $galleryJson;`r`n"
[System.IO.File]::WriteAllText((Join-Path $galleryPhotos 'indice.js'), $galleryContent, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("Catálogo atualizado: {0} imagem(ns). Abra index.html para visualizar." -f $galleryEntries.Count)
