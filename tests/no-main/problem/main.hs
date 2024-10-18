main = do
    line <- getLine
    let [x, y] = map read (words line)
    print (average x y)