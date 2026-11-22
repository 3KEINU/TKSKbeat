$expectedRemote = 'https://github.com/3KEINU/TKSKbeat.git'
$expectedBranch = 'main'
$expectedSite = 'https://3keinu.github.io/TKSKbeat/'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$remote = (git -C $root remote get-url origin).Trim()
$branch = (git -C $root branch --show-current).Trim()

if ($LASTEXITCODE -ne 0 -or $remote -ne $expectedRemote) {
  throw "Production target rejected. Expected remote: $expectedRemote; actual: $remote"
}

if ($branch -ne $expectedBranch) {
  throw "Production target rejected. Expected branch: $expectedBranch; actual: $branch"
}

Write-Output "Production target verified: $expectedSite ($expectedRemote#$expectedBranch)"
