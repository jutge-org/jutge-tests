from yogi import scan

a, b, c, d = scan(int), scan(int), scan(int), scan(int)
while a is not None and b is not None and c is not None and d is not None:
    print(max4(a, b, c, d))
    a, b, c, d = scan(int), scan(int), scan(int), scan(int)
