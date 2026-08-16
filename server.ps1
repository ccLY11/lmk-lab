$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 9888)
$listener.Start()
Write-Host "Serving on http://localhost:9888/"
$nl = "`r`n"
while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    try {
        $buf = New-Object byte[] 65536
        $n = $stream.Read($buf, 0, $buf.Length)
        $req = [Text.Encoding]::ASCII.GetString($buf, 0, $n)
        $path = "index.html"
        if ($req -match 'GET\s+(\S+)') { $path = $matches[1] }
        if ($path -eq '/') { $path = 'index.html' }
        $fp = Join-Path $root $path.TrimStart('/')
        if ([IO.File]::Exists($fp)) {
            $ext = [IO.Path]::GetExtension($fp)
            $mime = 'application/octet-stream'
            if ($ext -eq '.html') { $mime = 'text/html; charset=utf-8' }
            elseif ($ext -eq '.css') { $mime = 'text/css; charset=utf-8' }
            elseif ($ext -eq '.js') { $mime = 'application/javascript; charset=utf-8' }
            elseif ($ext -eq '.png') { $mime = 'image/png' }
            elseif ($ext -eq '.jpg') { $mime = 'image/jpeg' }
            elseif ($ext -eq '.svg') { $mime = 'image/svg+xml' }
            elseif ($ext -eq '.ico') { $mime = 'image/x-icon' }
            $data = [IO.File]::ReadAllBytes($fp)
            $hdr = "HTTP/1.1 200 OK" + $nl + "Content-Type: $mime" + $nl + "Content-Length: $($data.Length)" + $nl + "Cache-Control: no-cache" + $nl + "Connection: close" + $nl + $nl
            $hdrB = [Text.Encoding]::ASCII.GetBytes($hdr)
            $stream.Write($hdrB, 0, $hdrB.Length)
            $stream.Write($data, 0, $data.Length)
        } else {
            $msg = [Text.Encoding]::UTF8.GetBytes('Not Found')
            $hdr = "HTTP/1.1 404 Not Found" + $nl + "Content-Length: $($msg.Length)" + $nl + "Connection: close" + $nl + $nl
            $hdrB = [Text.Encoding]::ASCII.GetBytes($hdr)
            $stream.Write($hdrB, 0, $hdrB.Length)
            $stream.Write($msg, 0, $msg.Length)
        }
    } catch {} finally {
        $stream.Close()
        $client.Close()
    }
}