# POS-58 Thermal Printer Server (PowerShell)
# Listens on http://localhost:9100/print for receipt data

$port = 9100
$printerName = "USB Printing Support"  # Your thermal printer

# Create HTTP listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " POS Print Server Started" -ForegroundColor Green
Write-Host " Listening on: http://localhost:$port" -ForegroundColor Yellow
Write-Host " Printer: $printerName" -ForegroundColor Yellow
Write-Host " Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan

function Format-Currency($value) {
    return "PHP " + [math]::Round([double]$value, 2).ToString("0.00")
}

function Pad-Line($left, $right, $width = 32) {
    $leftStr = $left.ToString().Trim()
    $rightStr = $right.ToString().Trim()
    $available = $width - $leftStr.Length - $rightStr.Length
    if ($available -lt 1) { $available = 1 }
    $spacer = " " * $available
    return ($leftStr + $spacer + $rightStr).Substring(0, [Math]::Min($width, $leftStr.Length + $available + $rightStr.Length))
}

function Build-ReceiptLines($receipt) {
    $MAX_WIDTH = 32
    $lines = @()
    
    $storeName = if ($receipt.storeName) { $receipt.storeName } else { "Create Your Style" }
    $contactNumber = if ($receipt.contactNumber) { $receipt.contactNumber } else { "+631112224444" }
    $location = if ($receipt.location) { $receipt.location } else { "Pasonanca, Zamboanga City" }
    $issueTime = if ($receipt.time) { $receipt.time } else { "12:00PM" }
    $referenceNo = if ($receipt.referenceNo) { $receipt.referenceNo } elseif ($receipt.reference) { $receipt.reference } else { "-" }
    
    # Header
    $lines += $storeName
    $lines += Pad-Line $issueTime $contactNumber $MAX_WIDTH
    $lines += $location
    $lines += "-" * $MAX_WIDTH
    
    # Receipt No
    $lines += "Receipt No:"
    $receiptNo = if ($receipt.receiptNo) { $receipt.receiptNo } else { "000000" }
    $lines += "#$receiptNo"
    $lines += "-" * $MAX_WIDTH
    
    # Item headers
    $lines += "Item".PadRight(20) + "Qty".PadLeft(3) + "Price".PadLeft(9)
    $lines += "-" * $MAX_WIDTH
    
    # Items
    if ($receipt.items) {
        foreach ($item in $receipt.items) {
            $itemName = if ($item.name) { $item.name } elseif ($item.itemName) { $item.itemName } else { "Item" }
            $qty = if ($item.qty) { $item.qty } elseif ($item.quantity) { $item.quantity } else { 1 }
            $price = if ($item.price) { $item.price } elseif ($item.itemPrice) { $item.itemPrice } else { 0 }
            
            $itemNameStr = $itemName.ToString().Substring(0, [Math]::Min(20, $itemName.Length)).PadRight(20)
            $qtyStr = $qty.ToString().PadLeft(3)
            $priceStr = (Format-Currency $price).PadLeft(9)
            $lines += "$itemNameStr$qtyStr$priceStr"
        }
    }
    
    $lines += "-" * $MAX_WIDTH
    
    # Payment summary
    $lines += Pad-Line "Transaction/Reference" $referenceNo $MAX_WIDTH
    $paymentMethod = if ($receipt.paymentMethod) { $receipt.paymentMethod } else { "CASH" }
    $lines += Pad-Line "Payment Method" $paymentMethod $MAX_WIDTH
    $subtotal = if ($receipt.subtotal) { $receipt.subtotal } else { 0 }
    $lines += Pad-Line "Subtotal" (Format-Currency $subtotal) $MAX_WIDTH
    $lines += "-" * $MAX_WIDTH
    $discount = if ($receipt.discount) { $receipt.discount } else { 0 }
    $lines += Pad-Line "Discount" (Format-Currency $discount) $MAX_WIDTH
    $lines += "-" * $MAX_WIDTH
    $total = if ($receipt.total) { $receipt.total } else { 0 }
    $lines += Pad-Line "Total" (Format-Currency $total) $MAX_WIDTH
    
    if ($null -ne $receipt.cash) {
        $lines += Pad-Line "Cash" (Format-Currency $receipt.cash) $MAX_WIDTH
    }
    
    if ($null -ne $receipt.change) {
        $lines += Pad-Line "Change" (Format-Currency $receipt.change) $MAX_WIDTH
    }
    
    $lines += "-" * $MAX_WIDTH
    $lines += "This is not an official receipt"
    
    if ($receipt.cashier) {
        $lines += Pad-Line "Cashier" $receipt.cashier $MAX_WIDTH
    }
    
    # Add blank lines for paper feed
    $lines += ""
    $lines += ""
    $lines += ""
    
    return $lines
}

function Send-ToPrinter($lines) {
    $text = $lines -join "`r`n"
    
    # ESC/POS commands
    $ESC = [char]27
    $GS = [char]29
    $INIT = "$ESC@"           # Initialize printer
    $CUT = "$GS" + "V" + [char]66 + [char]0  # Partial cut
    
    $printData = $INIT + $text + "`r`n`r`n`r`n" + $CUT
    
    try {
        # Method 1: Try direct USB/Serial printing via .NET
        $printers = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name LIKE '%$printerName%'"
        
        if ($printers) {
            # Use Out-Printer cmdlet
            $text | Out-Printer -Name $printerName
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Printed via Out-Printer" -ForegroundColor Green
            return $true
        }
        
        # Method 2: Try raw printing to USB port
        $rawPrinter = "\\.\USB001"  # Common USB printer port
        if (Test-Path $rawPrinter) {
            [System.IO.File]::WriteAllText($rawPrinter, $printData)
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Printed via raw USB" -ForegroundColor Green
            return $true
        }
        
        # Method 3: Fallback - print using default Windows printer
        Add-Type -AssemblyName System.Drawing
        $printDoc = New-Object System.Drawing.Printing.PrintDocument
        $printDoc.PrinterSettings.PrinterName = $printerName
        
        $lineIndex = 0
        $printDoc.add_PrintPage({
            param($sender, $e)
            $font = New-Object System.Drawing.Font("Courier New", 8)
            $brush = [System.Drawing.Brushes]::Black
            $y = 10
            foreach ($line in $lines) {
                $e.Graphics.DrawString($line, $font, $brush, 10, $y)
                $y += 12
            }
        })
        
        $printDoc.Print()
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Printed via PrintDocument" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Print error: $_" -ForegroundColor Red
        return $false
    }
}

# Main loop
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # CORS headers
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
        
        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }
        
        if ($request.HttpMethod -eq "GET" -and $request.Url.AbsolutePath -eq "/health") {
            $responseJson = '{"status":"ok"}'
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
            $response.ContentType = "application/json"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }
        
        if ($request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/print") {
            $reader = New-Object System.IO.StreamReader($request.InputStream)
            $body = $reader.ReadToEnd()
            $reader.Close()
            
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Received print request" -ForegroundColor Cyan
            
            try {
                $receipt = $body | ConvertFrom-Json
                $lines = Build-ReceiptLines $receipt
                
                Write-Host "--- Receipt Preview ---" -ForegroundColor DarkGray
                foreach ($line in $lines) {
                    Write-Host $line -ForegroundColor DarkGray
                }
                Write-Host "-----------------------" -ForegroundColor DarkGray
                
                $success = Send-ToPrinter $lines
                
                if ($success) {
                    $responseJson = '{"ok":true}'
                    $response.StatusCode = 200
                } else {
                    $responseJson = '{"ok":false,"message":"Print failed"}'
                    $response.StatusCode = 500
                }
            }
            catch {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Error: $_" -ForegroundColor Red
                $responseJson = "{`"ok`":false,`"message`":`"$_`"}"
                $response.StatusCode = 500
            }
            
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
            $response.ContentType = "application/json"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }
        
        # 404 for other requests
        $response.StatusCode = 404
        $response.Close()
    }
}
finally {
    $listener.Stop()
    Write-Host "Server stopped" -ForegroundColor Yellow
}
