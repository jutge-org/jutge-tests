
def max2(a, b):
    return a if a > b else b


def max4(a, b, c, d):
    return max2(max2(a, b), max2(c, d))
