@echo off
set curr_dir=%cd%
chdir /D "%~dp0"

node ..\..\bin\typedoc --module commonjs --includeDeclarations --externalPattern **/lib/** --verbose --name "TypeDoc Documentation" --out doc\ ..\..\src\

chdir /D "%curr_dir%"