(define (doit x x-max dx)
   (if (<= x x-max)
      (begin
         666
         (doit (+ x dx) x-max dx))))

(doit 1 10 0) ; execute loop from a to b in steps of dx
