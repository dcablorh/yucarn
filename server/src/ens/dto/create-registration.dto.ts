import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRegistrationDto {
  // Shape only. The real rules live in validateLabel, which the service
  // applies — this keeps a 10 MB body from reaching it.
  @IsString()
  @MinLength(3)
  @MaxLength(63)
  label!: string;
}
